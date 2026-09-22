import { getDb } from "./db";
import { computeKeys } from "@/phonetics";
import { getScope } from "./scopes";
import { publicImageUrl } from "./publications";
import type { ClientMark } from "@/types";

/** Fragmento SQL para filtrar por organización (null = cartera legado global). */
function orgFilter(db: NonNullable<ReturnType<typeof getDb>>, orgId: number | null) {
  return orgId == null ? db`organization_id IS NULL` : db`organization_id = ${orgId}`;
}

/**
 * Importa (reemplaza) la cartera de UNA organización. Solo borra las marcas de
 * esa org, dejando intactas las de las demás. Devuelve el conteo insertado.
 */
export async function importCartera(marks: ClientMark[], orgId: number | null): Promise<number> {
  const db = getDb();
  if (!db) throw new Error("Sin base de datos configurada.");

  await db`DELETE FROM client_marks WHERE ${orgFilter(db, orgId)}`;
  const CHUNK = 500;
  for (let i = 0; i < marks.length; i += CHUNK) {
    const batch = marks.slice(i, i + CHUNK).map((m) => ({
      case_id: m.id, code: m.code, denom: m.denom, classes: m.classes,
      pys: m.pys, holder: m.holder, attorney: m.attorney, status: m.status,
      country: m.country, filed_date: m.filedDate, valid_until: m.validUntil, register_date: m.registerDate,
      organization_id: orgId,
    }));
    await db`INSERT INTO client_marks ${db(batch, "case_id", "code", "denom", "classes", "pys", "holder", "attorney", "status", "country", "filed_date", "valid_until", "register_date", "organization_id")}`;
  }
  return marks.length;
}

export interface CarteraMark {
  id: number; denom: string; code: string; caseId: string; classes: number[];
  pys: string; holder: string; status: string; country: string; imageUrl: string | null;
}
export interface CarteraMarksPage {
  rows: CarteraMark[]; total: number; page: number; pageSize: number; pages: number; withImages: number;
}

/** Marcas de la cartera de una org (paginadas, con imagen si existe). Para el visor. */
export async function listCarteraMarks(
  orgId: number | null,
  opts: { q?: string; page?: number; pageSize?: number; onlyImages?: boolean } = {}
): Promise<CarteraMarksPage> {
  const db = getDb();
  const pageSize = Math.min(Math.max(opts.pageSize ?? 48, 12), 120);
  const page = Math.max(opts.page ?? 1, 1);
  const offset = (page - 1) * pageSize;
  const empty: CarteraMarksPage = { rows: [], total: 0, page, pageSize, pages: 0, withImages: 0 };
  if (!db || orgId == null) return empty;

  const q = (opts.q ?? "").trim();
  const qFilter = q
    ? db`AND (cm.denom ILIKE ${"%" + q + "%"} OR cm.code ILIKE ${"%" + q + "%"} OR cm.case_id ILIKE ${"%" + q + "%"} OR cm.holder ILIKE ${"%" + q + "%"})`
    : db``;
  const imgFilter = opts.onlyImages ? db`AND ci.path IS NOT NULL` : db``;

  const [{ n }] = await db<{ n: number }[]>`
    SELECT count(*)::int AS n FROM client_marks cm
    LEFT JOIN cartera_images ci ON ci.organization_id = cm.organization_id AND ci.code = cm.code
    WHERE cm.organization_id = ${orgId} ${qFilter} ${imgFilter}`;
  const [{ w }] = await db<{ w: number }[]>`
    SELECT count(*)::int AS w FROM client_marks cm
    JOIN cartera_images ci ON ci.organization_id = cm.organization_id AND ci.code = cm.code
    WHERE cm.organization_id = ${orgId}`;
  const rows = await db<{
    id: number; denom: string; code: string | null; case_id: string | null; classes: number[] | null;
    pys: string | null; holder: string | null; status: string | null; country: string | null; bucket: string | null; path: string | null;
  }[]>`
    SELECT cm.id, cm.denom, cm.code, cm.case_id, cm.classes, cm.pys, cm.holder, cm.status, cm.country, ci.bucket, ci.path
    FROM client_marks cm
    LEFT JOIN cartera_images ci ON ci.organization_id = cm.organization_id AND ci.code = cm.code
    WHERE cm.organization_id = ${orgId} ${qFilter} ${imgFilter}
    ORDER BY (ci.path IS NULL), cm.denom
    LIMIT ${pageSize} OFFSET ${offset}`;
  return {
    rows: rows.map((r) => ({
      id: r.id, denom: r.denom, code: r.code ?? "", caseId: r.case_id ?? "", classes: r.classes ?? [],
      pys: r.pys ?? "", holder: r.holder ?? "", status: r.status ?? "", country: r.country ?? "",
      imageUrl: publicImageUrl(r.bucket, r.path),
    })),
    total: n, page, pageSize, pages: Math.max(1, Math.ceil(n / pageSize)), withImages: w,
  };
}

export async function getCarteraInfo(orgId: number | null = null): Promise<{ count: number; updatedAt: string | null } | null> {
  const db = getDb();
  if (!db) return null;
  const [r] = await db<{ count: number; updated: string | null }[]>`
    SELECT count(*)::int AS count, max(created_at) AS updated
    FROM client_marks WHERE ${orgFilter(db, orgId)}
  `;
  return { count: r?.count ?? 0, updatedAt: r?.updated ?? null };
}

/**
 * Carga la cartera desde la BD y recomputa las claves fonéticas en memoria.
 * Con `scope` aplica el perfil de vigilancia del país (subconjunto de la cartera).
 */
export async function loadMarksFromDb(scope?: { orgId: number | null; country: string }): Promise<ClientMark[]> {
  const db = getDb();
  if (!db) return [];

  const orgId = scope?.orgId ?? null;
  // Filtro base: solo la cartera de esta organización (null = legado global).
  const conds = [orgId == null ? db`cm.organization_id IS NULL` : db`cm.organization_id = ${orgId}`];

  if (scope) {
    const sc = await getScope(scope.orgId, scope.country);
    if (sc.mode !== "all") {
      const orgK = scope.orgId ?? 0;
      const inc = [
        db`cm.id IN (SELECT mark_id FROM watch_marks WHERE organization_id = ${orgK} AND country = ${sc.country})`,
      ];
      if (sc.holders.length) inc.push(db`cm.holder = ANY(${sc.holders})`);
      if (sc.caseIds.length) inc.push(db`(cm.case_id = ANY(${sc.caseIds}) OR cm.code = ANY(${sc.caseIds}))`);
      let cond = inc[0];
      for (let i = 1; i < inc.length; i++) cond = db`${cond} OR ${inc[i]}`;
      conds.push(sc.mode === "include" ? db`(${cond})` : db`NOT (${cond})`);
    }
  }

  let where = conds[0];
  for (let i = 1; i < conds.length; i++) where = db`${where} AND ${conds[i]}`;

  const rows = await db<{
    case_id: string | null; code: string | null; denom: string;
    classes: number[] | null; pys: string | null; holder: string | null;
    attorney: string | null; status: string | null; country: string | null;
    filed_date: string | null; valid_until: string | null; register_date: string | null;
  }[]>`
    SELECT cm.case_id, cm.code, cm.denom, cm.classes, cm.pys, cm.holder, cm.attorney, cm.status,
           cm.country, cm.filed_date, cm.valid_until, cm.register_date
    FROM client_marks cm WHERE ${where}
  `;
  return rows.map((r) => ({
    id: r.case_id ?? "",
    code: r.code ?? "",
    denom: r.denom,
    classes: r.classes ?? [],
    pys: r.pys ?? "",
    holder: r.holder ?? "",
    attorney: r.attorney ?? "",
    status: r.status ?? "",
    country: r.country ?? "",
    filedDate: r.filed_date ?? "",
    validUntil: r.valid_until ?? "",
    registerDate: r.register_date ?? "",
    keys: computeKeys(r.denom),
  }));
}
