"use server";

import { parseClientMarks, parseClientMarksFromGazette, parseGazette, parseAllPublications } from "@/load";
import { sweep } from "@/sweep";
import { toReportDTO, type ReportDTO } from "@/lib/dto";
import { getDb } from "@/lib/db";
import { savePublications, loadGazetteEntries } from "@/lib/publications";
import { upsertGazette, gazetteHasPublications, getGazetteMeta, listReusableGazettes, type ReusableGazette } from "@/lib/gazettes";
import { importCartera, loadMarksFromDb, getCarteraInfo, listCarteraMarks, type CarteraMarksPage } from "@/lib/cartera";
import { analyzeRunBatch, type BatchResult } from "@/lib/ai-web";
import { setReview, setReviewsBulk, getReviews, type ReviewStatus, type RunReviews } from "@/lib/reviews";
import { getSession } from "@/lib/auth";
import { mintSupabaseToken, realtimeTokenTtl } from "@/lib/supabase-token";
import type { ClientMark, GazetteMeta, GazetteEntry } from "@/types";

/** Inserta la fila de la corrida (barrido contra la cartera de una org). */
async function insertRunRow(
  db: NonNullable<ReturnType<typeof getDb>>, meta: GazetteMeta, dto: ReportDTO,
  clientCount: number, gazetteCount: number, orgId: number | null, gazetteId: number | null
): Promise<number> {
  const [row] = await db<{ id: number }[]>`
    INSERT INTO runs (
      country, gazette_number, date_public, date_due, language,
      client_count, gazette_count, n_candidates, n_own, ai_ran, payload, organization_id, gazette_id
    ) VALUES (
      ${meta.country}, ${meta.number}, ${meta.datePublic || null}, ${meta.dateDue || null}, ${meta.language},
      ${clientCount}, ${gazetteCount}, ${dto.stats.candidates}, ${dto.stats.own}, false, ${db.json(dto as any)}, ${orgId}, ${gazetteId}
    ) RETURNING id`;
  return row.id;
}

export interface RunResult {
  ok: boolean;
  error?: string;
  dto?: ReportDTO;
  runId?: number | null;
  elapsedMs?: number;
}

// Barrido + guardado (compartido por ambos flujos). Recibe la gaceta ya parseada.
async function sweepAndSave(marks: ClientMark[], parsed: ReturnType<typeof parseGazette>, gazetteDoc: any, orgId: number | null, t0: number): Promise<RunResult> {
  const { meta, entries, skipped } = parsed;
  const { candidates } = sweep(entries, marks);
  const dto = toReportDTO(candidates, meta, { clientCount: marks.length, gazetteCount: entries.length, skipped });

  let runId: number | null = null;
  const db = getDb();
  if (db) {
    try {
      // Gaceta compartida: se crea/actualiza una vez por país+número y se reutiliza.
      const gazetteId = await upsertGazette(meta);
      runId = await insertRunRow(db, meta, dto, marks.length, entries.length, orgId, gazetteId);
      // Publicaciones + imágenes: se guardan una sola vez por gaceta; si ya existen
      // (otra org las cargó antes), se reutilizan sin re-insertar.
      try {
        if (gazetteId != null && !(await gazetteHasPublications(gazetteId))) {
          await savePublications(gazetteId, parseAllPublications(gazetteDoc));
        }
      } catch (e) {
        console.error("[vsion] no se pudieron guardar las publicaciones:", e);
      }
    } catch (e) {
      console.error("[vsion] no se pudo guardar la corrida:", e);
    }
  }
  return { ok: true, dto, runId, elapsedMs: Date.now() - t0 };
}

async function requireUploader(): Promise<RunResult | null> {
  const s = await getSession();
  if (s?.role !== "superadmin") return { ok: false, error: "No autorizado." };
  return null;
}

/** Resuelve la organización de la corrida: el superadmin la elige; validada contra la BD. */
async function resolveRunOrg(organizationId: number | null): Promise<number | null | RunResult> {
  const s = await getSession();
  // superadmin puede elegir cualquiera; otros roles quedan atados a la suya
  if (s?.role !== "superadmin") return s?.organizationId ?? null;
  if (organizationId == null) return { ok: false, error: "Elige una organización para la corrida." };
  const db = getDb();
  if (db) {
    const [o] = await db<{ id: number }[]>`SELECT id FROM organizations WHERE id = ${organizationId}`;
    if (!o) return { ok: false, error: "Organización no válida." };
  }
  return organizationId;
}

/** Compara subiendo AMBOS archivos (cartera + gaceta). Funciona sin BD. */
export async function runComparison(clientText: string, gazetteText: string, organizationId: number | null = null): Promise<RunResult> {
  const denied = await requireUploader(); if (denied) return denied;
  const org = await resolveRunOrg(organizationId);
  if (org && typeof org === "object") return org;
  const t0 = Date.now();
  let clientRows: any, gazetteDoc: any;
  try {
    clientRows = JSON.parse(clientText);
    gazetteDoc = JSON.parse(gazetteText);
  } catch {
    return { ok: false, error: "Alguno de los archivos no es JSON válido." };
  }
  if (!Array.isArray(clientRows)) return { ok: false, error: "La cartera debe ser un arreglo JSON (casos.json)." };
  if (!gazetteDoc?.details) return { ok: false, error: "La gaceta no tiene 'details'. ¿Es el JSON correcto?" };
  return sweepAndSave(parseClientMarks(clientRows), parseGazette(gazetteDoc), gazetteDoc, org as number | null, t0);
}

/** Compara usando la cartera ya importada en la BD; solo se sube la gaceta. */
export async function runComparisonFromDb(gazetteText: string, organizationId: number | null = null): Promise<RunResult> {
  const denied = await requireUploader(); if (denied) return denied;
  const org = await resolveRunOrg(organizationId);
  if (org && typeof org === "object") return org;
  const orgId = org as number | null;
  const t0 = Date.now();
  let gazetteDoc: any;
  try {
    gazetteDoc = JSON.parse(gazetteText);
  } catch {
    return { ok: false, error: "La gaceta no es JSON válido." };
  }
  if (!gazetteDoc?.details) return { ok: false, error: "La gaceta no tiene 'details'. ¿Es el JSON correcto?" };
  const parsed = parseGazette(gazetteDoc);
  // Aplica el perfil de vigilancia del país de la gaceta para la organización elegida.
  const marks = await loadMarksFromDb({ orgId, country: parsed.meta.country });
  if (!marks.length) {
    return { ok: false, error: "No hay marcas de cartera para vigilar en este país. Revisa el perfil de vigilancia en Países, o importa la cartera." };
  }
  return sweepAndSave(marks, parsed, gazetteDoc, orgId, t0);
}

/** Gacetas ya cargadas que la org puede comparar sin re-subir (país habilitado,
 *  con publicaciones y aún no comparadas por esa org). */
export async function listReusableGazettesAction(organizationId: number | null = null): Promise<{ ok: boolean; gazettes?: ReusableGazette[]; error?: string }> {
  const s = await getSession();
  if (!s) return { ok: false, error: "No autenticado." };
  const orgId = s.role === "superadmin" ? organizationId : s.organizationId;
  if (orgId == null) return { ok: true, gazettes: [] };
  try {
    return { ok: true, gazettes: await listReusableGazettes(orgId) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error." };
  }
}

/** Compara una gaceta YA cargada contra la cartera de la org, sin re-subir el
 *  archivo: reconstruye las entradas desde las publicaciones guardadas. */
export async function runComparisonFromGazetteAction(gazetteId: number, organizationId: number | null = null): Promise<RunResult> {
  const denied = await requireUploader(); if (denied) return denied;
  const org = await resolveRunOrg(organizationId);
  if (org && typeof org === "object") return org;
  const orgId = org as number | null;
  const t0 = Date.now();
  const db = getDb();
  if (!db) return { ok: false, error: "Sin base de datos." };

  const meta = await getGazetteMeta(gazetteId);
  if (!meta) return { ok: false, error: "Gaceta no encontrada." };
  // Evita duplicar: si esta org ya comparó esta gaceta, no repite.
  const [dup] = await db<{ id: number }[]>`SELECT id FROM runs WHERE organization_id ${orgId == null ? db`IS NULL` : db`= ${orgId}`} AND gazette_id = ${gazetteId} LIMIT 1`;
  if (dup) return { ok: false, error: "Esta organización ya comparó esta gaceta.", runId: dup.id };

  const entries: GazetteEntry[] = await loadGazetteEntries(gazetteId);
  if (!entries.length) return { ok: false, error: "La gaceta no tiene publicaciones guardadas para comparar." };

  const marks = await loadMarksFromDb({ orgId, country: meta.country });
  if (!marks.length) {
    return { ok: false, error: "No hay marcas de cartera para vigilar en este país. Revisa el perfil de vigilancia en Países, o importa la cartera." };
  }

  const { candidates } = sweep(entries, marks);
  const dto = toReportDTO(candidates, meta, { clientCount: marks.length, gazetteCount: entries.length, skipped: 0 });
  let runId: number | null = null;
  try {
    runId = await insertRunRow(db, meta, dto, marks.length, entries.length, orgId, gazetteId);
  } catch (e) {
    console.error("[vsion] no se pudo guardar la corrida (reutilización):", e);
  }
  return { ok: true, dto, runId, elapsedMs: Date.now() - t0 };
}

/** Importa/reemplaza la cartera de una organización. Acepta casos.json (arreglo)
 *  o el formato gaceta ({ details: [...] }, p.ej. ccb.json). */
export async function importCarteraAction(clientText: string, organizationId: number | null = null): Promise<{ ok: boolean; count?: number; error?: string }> {
  const s = await getSession();
  if (s?.role !== "superadmin") return { ok: false, error: "No autorizado." };
  if (organizationId == null) return { ok: false, error: "Elige una organización." };
  const db = getDb();
  if (db) {
    const [o] = await db<{ id: number }[]>`SELECT id FROM organizations WHERE id = ${organizationId}`;
    if (!o) return { ok: false, error: "Organización no válida." };
  }
  let doc: any;
  try {
    doc = JSON.parse(clientText);
  } catch {
    return { ok: false, error: "El archivo no es JSON válido." };
  }
  let marks: ClientMark[];
  if (Array.isArray(doc)) marks = parseClientMarks(doc);                       // casos.json
  else if (doc && Array.isArray(doc.details)) marks = parseClientMarksFromGazette(doc); // formato gaceta (ccb.json)
  else return { ok: false, error: "Formato no reconocido: se espera casos.json (arreglo) o un JSON con 'details'." };
  if (!marks.length) return { ok: false, error: "No se encontraron marcas con denominación en el archivo." };
  try {
    const count = await importCartera(marks, organizationId);
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al importar." };
  }
}

export async function carteraInfoAction(organizationId: number | null = null) {
  const s = await getSession();
  if (!s) return null;
  // superadmin puede consultar cualquier org; los demás, solo la suya.
  const orgId = s.role === "superadmin" ? organizationId : s.organizationId;
  return getCarteraInfo(orgId);
}

/** Marcas de la cartera (con imagen) para el visor. superadmin elige org; otros la suya. */
export async function listCarteraMarksAction(
  organizationId: number | null,
  opts: { q?: string; page?: number; pageSize?: number; onlyImages?: boolean } = {}
): Promise<{ ok: boolean; page?: CarteraMarksPage; error?: string }> {
  const s = await getSession();
  if (!s) return { ok: false, error: "No autenticado." };
  const orgId = s.role === "superadmin" ? organizationId : s.organizationId;
  if (orgId == null) return { ok: true, page: { rows: [], total: 0, page: 1, pageSize: 48, pages: 0, withImages: 0 } };
  try {
    return { ok: true, page: await listCarteraMarks(orgId, opts) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error." };
  }
}

/** Aislamiento por organización: ¿la sesión puede operar sobre este run? */
async function canAccessRun(runId: number): Promise<boolean> {
  const s = await getSession();
  if (!s) return false;
  if (s.role === "superadmin") return true;
  const db = getDb();
  if (!db) return false;
  const [r] = await db<{ organization_id: number | null }[]>`SELECT organization_id FROM runs WHERE id = ${runId}`;
  return !!r && r.organization_id != null && Number(r.organization_id) === s.organizationId;
}

/** Fase 2: analiza un lote de conflictos con IA y persiste. El cliente llama en bucle. */
export async function analyzeBatchAction(runId: number, batchSize = 15): Promise<BatchResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "No autenticado.", analyzed: 0, total: 0, remaining: 0 };
  if (!(await canAccessRun(runId))) return { ok: false, error: "No autorizado.", analyzed: 0, total: 0, remaining: 0 };
  return analyzeRunBatch(runId, batchSize);
}

/** Borra una comparación (solo superadmin). */
export async function deleteRunAction(runId: number): Promise<{ ok: boolean; error?: string }> {
  const s = await getSession();
  if (s?.role !== "superadmin") return { ok: false, error: "No autorizado." };
  const db = getDb();
  if (!db) return { ok: false, error: "Sin base de datos." };
  try {
    await db`DELETE FROM reviews WHERE run_id = ${runId}`;
    await db`DELETE FROM runs WHERE id = ${runId}`;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error." };
  }
}

/** Fase 3: fija/limpia la decisión humana de un candidato (registra quién). */
export async function setReviewAction(runId: number, candKey: string, status: ReviewStatus | null): Promise<{ ok: boolean; error?: string }> {
  try {
    const s = await getSession();
    if (!s) return { ok: false, error: "No autenticado." };
    if (!(await canAccessRun(runId))) return { ok: false, error: "No autorizado." };
    await setReview(runId, candKey, status, { id: s.userId, name: s.name || s.email });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

/** Acción masiva: fija un mismo estado a varios candidatos (p.ej. descartar todas las pendientes). */
export async function setReviewsBulkAction(runId: number, candKeys: string[], status: ReviewStatus): Promise<{ ok: boolean; error?: string }> {
  try {
    const s = await getSession();
    if (!s) return { ok: false, error: "No autenticado." };
    if (!(await canAccessRun(runId))) return { ok: false, error: "No autorizado." };
    await setReviewsBulk(runId, candKeys, status, { id: s.userId, name: s.name || s.email });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

/** Re-lee los estados+atribución de una corrida (resync tras (re)conectar Realtime). */
export async function getReviewsAction(runId: number): Promise<RunReviews> {
  const s = await getSession();
  if (!s) return { statuses: {}, reviewers: {} };
  if (!(await canAccessRun(runId))) return { statuses: {}, reviewers: {} };
  return getReviews(runId);
}

/**
 * Emite un token Supabase (rol authenticated) para que el cliente se suscriba a
 * Realtime. Solo para usuarios logueados. Devuelve null si no hay sesión o no
 * está configurado SUPABASE_JWT_SECRET → el cliente no activa el sync en vivo.
 */
export async function getRealtimeTokenAction(): Promise<{ token: string; ttl: number } | null> {
  const s = await getSession();
  if (!s) return null;
  const token = await mintSupabaseToken(s);
  if (!token) return null;
  return { token, ttl: realtimeTokenTtl() };
}
