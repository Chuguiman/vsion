"use server";

import { parseClientMarks, parseGazette } from "@/load";
import { sweep } from "@/sweep";
import { toReportDTO, type ReportDTO } from "@/lib/dto";
import { getDb } from "@/lib/db";

export interface RunResult {
  ok: boolean;
  error?: string;
  dto?: ReportDTO;
  runId?: number | null;
  elapsedMs?: number;
}

/** Parsea cartera + gaceta, corre el barrido y (si hay BD) guarda la corrida. */
export async function runComparison(clientText: string, gazetteText: string): Promise<RunResult> {
  const t0 = Date.now();
  let clientRows: any, gazetteDoc: any;
  try {
    clientRows = JSON.parse(clientText);
    gazetteDoc = JSON.parse(gazetteText);
  } catch {
    return { ok: false, error: "Alguno de los archivos no es JSON válido." };
  }
  if (!Array.isArray(clientRows)) {
    return { ok: false, error: "La cartera del cliente debe ser un arreglo JSON (casos.json)." };
  }
  if (!gazetteDoc?.details) {
    return { ok: false, error: "La gaceta no tiene 'details'. ¿Es el JSON correcto?" };
  }

  const marks = parseClientMarks(clientRows);
  const { meta, entries, skipped } = parseGazette(gazetteDoc);
  const { candidates } = sweep(entries, marks);
  const dto = toReportDTO(candidates, meta, {
    clientCount: marks.length,
    gazetteCount: entries.length,
    skipped,
  });

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
