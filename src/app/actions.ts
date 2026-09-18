"use server";

import { parseClientMarks, parseGazette } from "@/load";
import { sweep } from "@/sweep";
import { toReportDTO, type ReportDTO } from "@/lib/dto";
import { getDb } from "@/lib/db";
import { importCartera, loadMarksFromDb, getCarteraInfo } from "@/lib/cartera";
import { analyzeRunBatch, type BatchResult } from "@/lib/ai-web";
import { setReview, type ReviewStatus } from "@/lib/reviews";
import { getSession } from "@/lib/auth";
import type { ClientMark } from "@/types";

export interface RunResult {
  ok: boolean;
  error?: string;
  dto?: ReportDTO;
  runId?: number | null;
  elapsedMs?: number;
}

// Barrido + guardado (compartido por ambos flujos)
async function sweepAndSave(marks: ClientMark[], gazetteDoc: any, t0: number): Promise<RunResult> {
  if (!gazetteDoc?.details) return { ok: false, error: "La gaceta no tiene 'details'. ¿Es el JSON correcto?" };

  const { meta, entries, skipped } = parseGazette(gazetteDoc);
  const { candidates } = sweep(entries, marks);
  const dto = toReportDTO(candidates, meta, { clientCount: marks.length, gazetteCount: entries.length, skipped });

  let runId: number | null = null;
  const db = getDb();
  if (db) {
    try {
      const [row] = await db<{ id: number }[]>`
        INSERT INTO runs (
          country, gazette_number, date_public, date_due, language,
          client_count, gazette_count, n_candidates, n_own, ai_ran, payload
        ) VALUES (
          ${meta.country}, ${meta.number}, ${meta.datePublic || null}, ${meta.dateDue || null}, ${meta.language},
          ${marks.length}, ${entries.length}, ${dto.stats.candidates}, ${dto.stats.own}, false, ${db.json(dto as any)}
        ) RETURNING id
      `;
      runId = row.id;
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

/** Compara subiendo AMBOS archivos (cartera + gaceta). Funciona sin BD. */
export async function runComparison(clientText: string, gazetteText: string): Promise<RunResult> {
  const denied = await requireUploader(); if (denied) return denied;
  const t0 = Date.now();
  let clientRows: any, gazetteDoc: any;
  try {
    clientRows = JSON.parse(clientText);
    gazetteDoc = JSON.parse(gazetteText);
  } catch {
    return { ok: false, error: "Alguno de los archivos no es JSON válido." };
  }
  if (!Array.isArray(clientRows)) return { ok: false, error: "La cartera debe ser un arreglo JSON (casos.json)." };
  return sweepAndSave(parseClientMarks(clientRows), gazetteDoc, t0);
}

/** Compara usando la cartera ya importada en la BD; solo se sube la gaceta. */
export async function runComparisonFromDb(gazetteText: string): Promise<RunResult> {
  const denied = await requireUploader(); if (denied) return denied;
  const t0 = Date.now();
  let gazetteDoc: any;
  try {
    gazetteDoc = JSON.parse(gazetteText);
  } catch {
    return { ok: false, error: "La gaceta no es JSON válido." };
  }
  const marks = await loadMarksFromDb();
  if (!marks.length) return { ok: false, error: "No hay cartera importada. Ve a Cartera e impórtala primero." };
  return sweepAndSave(marks, gazetteDoc, t0);
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
  if (s?.role !== "superadmin") return { ok: false, error: "No autorizado.", analyzed: 0, total: 0, remaining: 0 };
  return analyzeRunBatch(runId, batchSize);
}

/** Fase 3: fija/limpia la decisión humana de un candidato. */
export async function setReviewAction(runId: number, candKey: string, status: ReviewStatus | null): Promise<{ ok: boolean; error?: string }> {
  try {
    const s = await getSession();
    if (s?.role !== "superadmin") return { ok: false, error: "No autorizado." };
    await setReview(runId, candKey, status);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}
