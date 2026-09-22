import { getDb } from "./db";

const orgKey = (orgId: number | null) => orgId ?? 0; // 0 = global (superadmin)

export type ScopeMode = "all" | "include" | "exclude";

export interface WatchScope {
  country: string;
  mode: ScopeMode;
  holders: string[];
  caseIds: string[];
  markCount: number; // marcas seleccionadas a mano
}

export interface MarkLite {
  id: number;
  denom: string;
  code: string | null;
  holder: string | null;
}

/** Perfil de vigilancia para (org, país). Sin fila => cartera completa. */
export async function getScope(orgId: number | null, country: string): Promise<WatchScope> {
  const cc = country.trim().toUpperCase();
  const db = getDb();
  if (!db) return { country: cc, mode: "all", holders: [], caseIds: [], markCount: 0 };
  const [s] = await db<{ mode: ScopeMode; holders: string[]; case_ids: string[] }[]>`
    SELECT mode, holders, case_ids FROM watch_scopes
    WHERE organization_id = ${orgKey(orgId)} AND country = ${cc}`;
  const [m] = await db<{ n: number }[]>`
    SELECT count(*)::int AS n FROM watch_marks
    WHERE organization_id = ${orgKey(orgId)} AND country = ${cc}`;
  return {
    country: cc,
    mode: s?.mode ?? "all",
    holders: s?.holders ?? [],
    caseIds: s?.case_ids ?? [],
    markCount: m?.n ?? 0,
  };
}

export async function setScope(
  orgId: number | null, country: string, mode: ScopeMode, holders: string[], caseIds: string[]
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Sin base de datos.");
  const cc = country.trim().toUpperCase();
  const h = [...new Set(holders.map((x) => x.trim()).filter(Boolean))];
  const c = [...new Set(caseIds.map((x) => x.trim()).filter(Boolean))];
  await db`
    INSERT INTO watch_scopes (organization_id, country, mode, holders, case_ids, updated_at)
    VALUES (${orgKey(orgId)}, ${cc}, ${mode}, ${h}, ${c}, now())
    ON CONFLICT (organization_id, country)
    DO UPDATE SET mode = ${mode}, holders = ${h}, case_ids = ${c}, updated_at = now()`;
}

export async function addWatchMark(orgId: number | null, country: string, markId: number): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Sin base de datos.");
  await db`
    INSERT INTO watch_marks (organization_id, country, mark_id)
    VALUES (${orgKey(orgId)}, ${country.trim().toUpperCase()}, ${markId})
    ON CONFLICT DO NOTHING`;
}

export async function removeWatchMark(orgId: number | null, country: string, markId: number): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Sin base de datos.");
  await db`
    DELETE FROM watch_marks
    WHERE organization_id = ${orgKey(orgId)} AND country = ${country.trim().toUpperCase()} AND mark_id = ${markId}`;
}

/** Marcas seleccionadas a mano para el país. */
export async function listWatchMarks(orgId: number | null, country: string): Promise<MarkLite[]> {
  const db = getDb();
  if (!db) return [];
  return db<MarkLite[]>`
    SELECT cm.id, cm.denom, cm.code, cm.holder
    FROM watch_marks w JOIN client_marks cm ON cm.id = w.mark_id
    WHERE w.organization_id = ${orgKey(orgId)} AND w.country = ${country.trim().toUpperCase()}
    ORDER BY cm.denom LIMIT 500`;
}

/** Titulares distintos de la cartera de la org (para el selector), con conteo. */
export async function listHolders(orgId: number | null, limit = 300): Promise<{ holder: string; n: number }[]> {
  const db = getDb();
  if (!db) return [];
  const org = orgId == null ? db`organization_id IS NULL` : db`organization_id = ${orgId}`;
  return db<{ holder: string; n: number }[]>`
    SELECT holder, count(*)::int AS n FROM client_marks
    WHERE holder IS NOT NULL AND holder <> '' AND ${org}
    GROUP BY holder ORDER BY n DESC, holder LIMIT ${limit}`;
}

/** Búsqueda de marcas en la cartera de la org por denominación o código/expediente. */
export async function searchMarks(orgId: number | null, q: string, limit = 20): Promise<MarkLite[]> {
  const db = getDb();
  if (!db || !q.trim()) return [];
  const like = `%${q.trim()}%`;
  const org = orgId == null ? db`organization_id IS NULL` : db`organization_id = ${orgId}`;
  return db<MarkLite[]>`
    SELECT id, denom, code, holder FROM client_marks
    WHERE (denom ILIKE ${like} OR code ILIKE ${like} OR case_id ILIKE ${like}) AND ${org}
    ORDER BY denom LIMIT ${limit}`;
}
