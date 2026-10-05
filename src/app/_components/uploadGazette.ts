"use client";

import { parseGazetteMeta, parseAllPublications } from "@/gazette-doc";
import type { GazetteMeta } from "@/types";
import { beginGazetteUploadAction, appendPublicationsAction, finishGazetteUploadAction } from "../gazettes-actions";

// Vercel corta los bodies de más de 4.5 MB antes de llegar a la server action
// ("An unexpected response was received from the server"). Por eso el JSON se
// lee aquí, se reduce a los campos que usamos y se envía en lotes pequeños.
const MAX_CHUNK_BYTES = 1_500_000;

export async function readGazetteFile(file: File): Promise<{ meta: GazetteMeta; doc: any }> {
  let doc: any;
  try {
    doc = JSON.parse(await file.text());
  } catch {
    throw new Error("El archivo no es JSON válido.");
  }
  if (!Array.isArray(doc?.details)) throw new Error("La gaceta no tiene 'details'. ¿Es el JSON correcto?");
  const meta = parseGazetteMeta(doc);
  if (!meta.country || !meta.number) throw new Error("La gaceta no trae país (codeCountry) o número en 'publication'.");
  return { meta, doc };
}

/** Sube la gaceta ya leída (cabecera + publicaciones por lotes). Devuelve su id. */
export async function uploadGazetteDoc(
  meta: GazetteMeta, doc: any, onProgress?: (done: number, total: number) => void
): Promise<number> {
  const rows = parseAllPublications(doc);
  if (!rows.length) throw new Error("La gaceta no tiene publicaciones.");
  const begin = await beginGazetteUploadAction({ ...meta, count: rows.length });
  if (!begin.ok) throw new Error(begin.error);

  const enc = new TextEncoder();
  let batch: typeof rows = [];
  let size = 2;
  let done = 0;
  onProgress?.(0, rows.length);
  const flush = async () => {
    if (!batch.length) return;
    const r = await appendPublicationsAction(begin.gazetteId, new Blob([JSON.stringify(batch)], { type: "application/json" }));
    if (!r.ok) throw new Error(r.error);
    done += batch.length;
    onProgress?.(done, rows.length);
    batch = []; size = 2;
  };
  for (const row of rows) {
    const bytes = enc.encode(JSON.stringify(row)).length + 1;
    if (size + bytes > MAX_CHUNK_BYTES) await flush();
    batch.push(row); size += bytes;
  }
  await flush();

  const fin = await finishGazetteUploadAction(begin.gazetteId);
  if (!fin.ok) throw new Error(fin.error);
  return begin.gazetteId;
}
