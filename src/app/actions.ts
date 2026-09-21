"use server";

import { parseClientMarks, parseGazette, parseAllPublications } from "@/load";
import { sweep } from "@/sweep";
import { toReportDTO, type ReportDTO } from "@/lib/dto";
import { getDb } from "@/lib/db";
import { savePublications } from "@/lib/publications";
import { importCartera, loadMarksFromDb, getCarteraInfo } from "@/lib/cartera";
import { analyzeRunBatch, type BatchResult } from "@/lib/ai-web";
import { setReview, getReviews, type ReviewStatus, type RunReviews } from "@/lib/reviews";
import { getSession } from "@/lib/auth";
import { mintSupabaseToken, realtimeTokenTtl } from "@/lib/supabase-token";
import type { ClientMark } from "@/types";

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
      const [row] = await db<{ id: number }[]>`
        INSERT INTO runs (
          country, gazette_number, date_public, date_due, language,
          client_count, gazette_count, n_candidates, n_own, ai_ran, payload, organization_id
        ) VALUES (
          ${meta.country}, ${meta.number}, ${meta.datePublic || null}, ${meta.dateDue || null}, ${meta.language},
          ${marks.length}, ${entries.length}, ${dto.stats.candidates}, ${dto.stats.own}, false, ${db.json(dto as any)}, ${orgId}
        ) RETURNING id
      `;
      runId = row.id;
      // Guarda la publicación completa (todas las entradas) para el visor paginado.
      try {
        await savePublications(runId, parseAllPublications(gazetteDoc));
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

/** Importa/reemplaza la cartera del cliente en la BD. */
export async function importCarteraAction(clientText: string): Promise<{ ok: boolean; count?: number; error?: string }> {
  const s = await getSession();
  if (s?.role !== "superadmin") return { ok: false, error: "No autorizado." };
  let rows: any;
  try {
    rows = JSON.parse(clientText);
  } catch {
    return { ok: false, error: "El archivo no es JSON válido." };
  }
  if (!Array.isArray(rows)) return { ok: false, error: "La cartera debe ser un arreglo JSON (casos.json)." };
  try {
    const count = await importCartera(rows);
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al importar." };
  }
}

export async function carteraInfoAction() {
  return getCarteraInfo();
}

/** Fase 2: analiza un lote de conflictos con IA y persiste. El cliente llama en bucle. */
export async function analyzeBatchAction(runId: number, batchSize = 15): Promise<BatchResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "No autenticado.", analyzed: 0, total: 0, remaining: 0 };
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
    await setReview(runId, candKey, status, { id: s.userId, name: s.name || s.email });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

/** Re-lee los estados+atribución de una corrida (resync tras (re)conectar Realtime). */
export async function getReviewsAction(runId: number): Promise<RunReviews> {
  const s = await getSession();
  if (!s) return { statuses: {}, reviewers: {} };
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
