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
      case_id: m.id, code: m.code, denom: m.denom, mark_type: m.markType, classes: m.classes,
      pys: m.pys, holder: m.holder, attorney: m.attorney, status: m.status,
      country: m.country, filed_date: m.filedDate, valid_until: m.validUntil, register_date: m.registerDate,
      filing_country: m.filingCountry ?? null, category: m.category ?? null, cert_number: m.certNumber ?? null,
      pub_number: m.pubNumber ?? null, pub_date: m.pubDate ?? null,
      organization_id: orgId,
    }));
    await db`INSERT INTO client_marks ${db(batch, "case_id", "code", "denom", "mark_type", "classes", "pys", "holder", "attorney", "status", "country", "filed_date", "valid_until", "register_date", "filing_country", "category", "cert_number", "pub_number", "pub_date", "organization_id")}`;
  }
  return marks.length;
}

export interface CarteraMark {
  id: number; denom: string; code: string; caseId: string; markType: string; classes: number[];
  pys: string; holder: string; attorney: string; status: string; country: string;
  filedDate: string; validUntil: string; registerDate: string; imageUrl: string | null;
  filingCountry: string; category: string; certNumber: string; pubNumber: string; pubDate: string;
}
export interface CarteraFacet { value: string; count: number }
export interface CarteraMarksPage {
  rows: CarteraMark[]; total: number; page: number; pageSize: number; pages: number; withImages: number;
  /** Valores disponibles en toda la cartera de la org (para los filtros). */
  facets?: { statuses: CarteraFacet[]; countries: CarteraFacet[]; filingCountries: CarteraFacet[]; classes: CarteraFacet[] };
}

export type CarteraSort = "denom" | "code" | "caseId" | "holder" | "attorney" | "status" | "country" | "filingCountry"
  | "category" | "markType" | "filed" | "valid" | "pub";
export interface CarteraListOpts {
  q?: string; page?: number; pageSize?: number; onlyImages?: boolean;
  statuses?: string[]; countries?: string[]; filingCountries?: string[]; classNums?: number[];
  sort?: CarteraSort; dir?: "asc" | "desc";
}

/** Fecha en texto (AAAA-MM-DD o D/M/AAAA, como llega de la fuente) → date ordenable; otra cosa → null. */
function sortableDate(db: NonNullable<ReturnType<typeof getDb>>, col: ReturnType<NonNullable<ReturnType<typeof getDb>>>) {
  return db`CASE WHEN ${col} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substr(${col}, 1, 10)::date
                 WHEN ${col} ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN to_date(${col}, 'DD/MM/YYYY') END`;
}

/** Marcas de la cartera de una org (paginadas, con imagen si existe). Para el visor. */
export async function listCarteraMarks(orgId: number | null, opts: CarteraListOpts = {}): Promise<CarteraMarksPage> {
  const db = getDb();
  const pageSize = Math.min(Math.max(opts.pageSize ?? 25, 10), 120);
  const page = Math.max(opts.page ?? 1, 1);
  const offset = (page - 1) * pageSize;
  const empty: CarteraMarksPage = { rows: [], total: 0, page, pageSize, pages: 0, withImages: 0 };
  if (!db || orgId == null) return empty;

  const q = (opts.q ?? "").trim();
  const like = "%" + q + "%";
  const filters = [
    q ? db`AND (cm.denom ILIKE ${like} OR cm.code ILIKE ${like} OR cm.case_id ILIKE ${like} OR cm.holder ILIKE ${like} OR cm.attorney ILIKE ${like})` : db``,
    opts.onlyImages ? db`AND ci.path IS NOT NULL` : db``,
    opts.statuses?.length ? db`AND coalesce(nullif(cm.status, ''), '—') = ANY(${opts.statuses})` : db``,
    opts.countries?.length ? db`AND coalesce(nullif(cm.country, ''), '—') = ANY(${opts.countries})` : db``,
    opts.classNums?.length ? db`AND cm.classes && ${opts.classNums}::int[]` : db``,
    opts.filingCountries?.length ? db`AND coalesce(nullif(cm.filing_country, ''), '—') = ANY(${opts.filingCountries})` : db``,
  ];
  const where = db`cm.organization_id = ${orgId} ${filters[0]} ${filters[1]} ${filters[2]} ${filters[3]} ${filters[4]} ${filters[5]}`;

  // Columnas ordenables (lista blanca). Vacías al final.
  const sortCol = {
    denom: db`lower(cm.denom)`, code: db`nullif(cm.code, '')`, caseId: db`nullif(cm.case_id, '')`,
    holder: db`nullif(lower(cm.holder), '')`, attorney: db`nullif(lower(cm.attorney), '')`,
    status: db`nullif(cm.status, '')`, country: db`nullif(cm.country, '')`, filingCountry: db`nullif(cm.filing_country, '')`,
    category: db`nullif(cm.category, '')`, markType: db`nullif(cm.mark_type, '')`, pub: sortableDate(db, db`cm.pub_date`),
    filed: sortableDate(db, db`cm.filed_date`), valid: sortableDate(db, db`cm.valid_until`),
  }[opts.sort ?? "denom"] ?? db`lower(cm.denom)`;
  const order = opts.sort
    ? db`${sortCol} ${opts.dir === "desc" ? db`DESC` : db`ASC`} NULLS LAST, cm.id`
    : db`(ci.path IS NULL), lower(cm.denom), cm.id`;

  const [{ n }] = await db<{ n: number }[]>`
    SELECT count(*)::int AS n FROM client_marks cm
    LEFT JOIN cartera_images ci ON ci.organization_id = cm.organization_id AND ci.code = cm.code
    WHERE ${where}`;
  const [{ w }] = await db<{ w: number }[]>`
    SELECT count(*)::int AS w FROM client_marks cm
    JOIN cartera_images ci ON ci.organization_id = cm.organization_id AND ci.code = cm.code
    WHERE cm.organization_id = ${orgId}`;
  const rows = await db<{
    id: number; denom: string; code: string | null; case_id: string | null; mark_type: string | null; classes: number[] | null;
    pys: string | null; holder: string | null; attorney: string | null; status: string | null; country: string | null;
    filed_date: string | null; valid_until: string | null; register_date: string | null; bucket: string | null; path: string | null;
    filing_country: string | null; category: string | null; cert_number: string | null; pub_number: string | null; pub_date: string | null;
  }[]>`
    SELECT cm.id, cm.denom, cm.code, cm.case_id, cm.mark_type, cm.classes, cm.pys, cm.holder, cm.attorney, cm.status, cm.country,
           cm.filed_date, cm.valid_until, cm.register_date, ci.bucket, ci.path,
           cm.filing_country, cm.category, cm.cert_number, cm.pub_number, cm.pub_date
    FROM client_marks cm
    LEFT JOIN cartera_images ci ON ci.organization_id = cm.organization_id AND ci.code = cm.code
    WHERE ${where}
    ORDER BY ${order}
    LIMIT ${pageSize} OFFSET ${offset}`;

  const facetRows = await db<{ kind: string; value: string; count: number }[]>`
    SELECT 's' AS kind, coalesce(nullif(status, ''), '—') AS value, count(*)::int AS count
      FROM client_marks WHERE organization_id = ${orgId} GROUP BY 2
    UNION ALL
    SELECT 'c', coalesce(nullif(country, ''), '—'), count(*)::int
      FROM client_marks WHERE organization_id = ${orgId} GROUP BY 2
    UNION ALL
    SELECT 'f', coalesce(nullif(filing_country, ''), '—'), count(*)::int
      FROM client_marks WHERE organization_id = ${orgId} GROUP BY 2
    UNION ALL
    SELECT 'n', k::text, count(*)::int
      FROM client_marks, unnest(classes) AS k WHERE organization_id = ${orgId} GROUP BY 2`;
  const facet = (kind: string) => facetRows.filter((f) => f.kind === kind).map(({ value, count }) => ({ value, count }));

  return {
    rows: rows.map((r) => ({
      id: r.id, denom: r.denom, code: r.code ?? "", caseId: r.case_id ?? "", markType: r.mark_type ?? "", classes: r.classes ?? [],
      pys: r.pys ?? "", holder: r.holder ?? "", attorney: r.attorney ?? "", status: r.status ?? "", country: r.country ?? "",
      filedDate: r.filed_date ?? "", validUntil: r.valid_until ?? "", registerDate: r.register_date ?? "",
      imageUrl: publicImageUrl(r.bucket, r.path),
      filingCountry: r.filing_country ?? "", category: r.category ?? "", certNumber: r.cert_number ?? "",
      pubNumber: r.pub_number ?? "", pubDate: r.pub_date ?? "",
    })),
    total: n, page, pageSize, pages: Math.max(1, Math.ceil(n / pageSize)), withImages: w,
    facets: {
      statuses: facet("s").sort((a, b) => b.count - a.count),
      countries: facet("c").sort((a, b) => b.count - a.count),
      filingCountries: facet("f").sort((a, b) => b.count - a.count),
      classes: facet("n").sort((a, b) => Number(a.value) - Number(b.value)),
    },
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
    case_id: string | null; code: string | null; denom: string; mark_type: string | null;
    classes: number[] | null; pys: string | null; holder: string | null;
    attorney: string | null; status: string | null; country: string | null;
    filed_date: string | null; valid_until: string | null; register_date: string | null;
  }[]>`
    SELECT cm.case_id, cm.code, cm.denom, cm.mark_type, cm.classes, cm.pys, cm.holder, cm.attorney, cm.status,
           cm.country, cm.filed_date, cm.valid_until, cm.register_date
    FROM client_marks cm WHERE ${where}
  `;
  return rows.map((r) => ({
    id: r.case_id ?? "",
    code: r.code ?? "",
    denom: r.denom,
    markType: r.mark_type ?? "",
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
