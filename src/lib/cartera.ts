import { getDb } from "./db";
import { parseClientMarks } from "@/load";
import { computeKeys } from "@/phonetics";
import { getScope } from "./scopes";
import type { ClientMark } from "@/types";

/** Importa (reemplaza) la cartera del cliente en la BD. Devuelve el conteo. */
export async function importCartera(rows: any[]): Promise<number> {
  const db = getDb();
  if (!db) throw new Error("Sin base de datos configurada.");
  const marks = parseClientMarks(rows);

  await db`TRUNCATE client_marks RESTART IDENTITY`;
  const CHUNK = 500;
  for (let i = 0; i < marks.length; i += CHUNK) {
    const batch = marks.slice(i, i + CHUNK).map((m) => ({
      case_id: m.id, code: m.code, denom: m.denom, classes: m.classes,
      pys: m.pys, holder: m.holder, attorney: m.attorney, status: m.status,
      country: m.country, filed_date: m.filedDate, valid_until: m.validUntil, register_date: m.registerDate,
    }));
    await db`INSERT INTO client_marks ${db(batch, "case_id", "code", "denom", "classes", "pys", "holder", "attorney", "status", "country", "filed_date", "valid_until", "register_date")}`;
  }
  return marks.length;
}

export async function getCarteraInfo(): Promise<{ count: number; updatedAt: string | null } | null> {
  const db = getDb();
  if (!db) return null;
  const [r] = await db<{ count: number; updated: string | null }[]>`
    SELECT count(*)::int AS count, max(created_at) AS updated FROM client_marks
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

  let where = db``;
  if (scope) {
    const sc = await getScope(scope.orgId, scope.country);
    if (sc.mode !== "all") {
      const orgK = scope.orgId ?? 0;
      const conds = [
        db`cm.id IN (SELECT mark_id FROM watch_marks WHERE organization_id = ${orgK} AND country = ${sc.country})`,
      ];
      if (sc.holders.length) conds.push(db`cm.holder = ANY(${sc.holders})`);
      if (sc.caseIds.length) conds.push(db`(cm.case_id = ANY(${sc.caseIds}) OR cm.code = ANY(${sc.caseIds}))`);
      let cond = conds[0];
      for (let i = 1; i < conds.length; i++) cond = db`${cond} OR ${conds[i]}`;
      where = sc.mode === "include" ? db`WHERE (${cond})` : db`WHERE NOT (${cond})`;
    }
  }

  const rows = await db<{
    case_id: string | null; code: string | null; denom: string;
    classes: number[] | null; pys: string | null; holder: string | null;
    attorney: string | null; status: string | null; country: string | null;
    filed_date: string | null; valid_until: string | null; register_date: string | null;
  }[]>`
    SELECT cm.case_id, cm.code, cm.denom, cm.classes, cm.pys, cm.holder, cm.attorney, cm.status,
           cm.country, cm.filed_date, cm.valid_until, cm.register_date
    FROM client_marks cm ${where}
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
