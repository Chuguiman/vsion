"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  upsertGazette, findGazette, listAllGazettes, updateGazette, deleteGazette,
  type GazetteRow,
} from "@/lib/gazettes";
import { insertPublications } from "@/lib/publications";
import type { PublicationRow } from "@/gazette-doc";
import type { GazetteMeta } from "@/types";

type Result<T = {}> = { ok: true } & T | { ok: false; error: string };

async function requireSuper(): Promise<string | null> {
  const s = await getSession();
  if (s?.role !== "superadmin") return "No autorizado.";
  if (!getDb()) return "Sin base de datos.";
  return null;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Error.");

export async function listGazettesAction(): Promise<Result<{ gazettes: GazetteRow[] }>> {
  const denied = await requireSuper(); if (denied) return { ok: false, error: denied };
  try {
    return { ok: true, gazettes: await listAllGazettes() };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** ¿Ya existe la gaceta país+número? Para avisar antes de reemplazar sus publicaciones. */
export async function findGazetteAction(country: string, number: string): Promise<Result<{ gazette: GazetteRow | null }>> {
  const denied = await requireSuper(); if (denied) return { ok: false, error: denied };
  try {
    return { ok: true, gazette: await findGazette(country, number) };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/**
 * Paso 1 de la subida por lotes: crea/actualiza la cabecera de la gaceta y borra
 * sus publicaciones previas. El navegador envía luego las publicaciones en lotes
 * con appendPublicationsAction (el JSON completo no cabe en el body de Vercel).
 */
export async function beginGazetteUploadAction(meta: GazetteMeta): Promise<Result<{ gazetteId: number }>> {
  const denied = await requireSuper(); if (denied) return { ok: false, error: denied };
  if (!meta.country || !meta.number) return { ok: false, error: "La gaceta no trae país (codeCountry) o número en 'publication'." };
  try {
    const gazetteId = await upsertGazette(meta);
    if (gazetteId == null) return { ok: false, error: "No se pudo crear la gaceta." };
    await getDb()!`DELETE FROM publications WHERE gazette_id = ${gazetteId}`;
    return { ok: true, gazetteId };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Paso 2: un lote de publicaciones (JSON en un Blob para no pasar por la serialización de React). */
export async function appendPublicationsAction(gazetteId: number, chunk: Blob): Promise<Result<{ inserted: number }>> {
  const denied = await requireSuper(); if (denied) return { ok: false, error: denied };
  let rows: PublicationRow[];
  try {
    rows = JSON.parse(await chunk.text());
    if (!Array.isArray(rows)) throw new Error();
  } catch {
    return { ok: false, error: "Lote de publicaciones inválido." };
  }
  try {
    await insertPublications(gazetteId, rows);
    return { ok: true, inserted: rows.length };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Paso 3: fija el conteo final y refresca las vistas. */
export async function finishGazetteUploadAction(gazetteId: number): Promise<Result> {
  const denied = await requireSuper(); if (denied) return { ok: false, error: denied };
  try {
    const db = getDb()!;
    await db`UPDATE gazettes SET count = (SELECT count(*) FROM publications WHERE gazette_id = ${gazetteId}) WHERE id = ${gazetteId}`;
    revalidatePath("/publicaciones");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateGazetteAction(
  gazetteId: number, patch: { datePublic: string | null; dateDue: string | null; language: string | null }
): Promise<Result> {
  const denied = await requireSuper(); if (denied) return { ok: false, error: denied };
  try {
    await updateGazette(gazetteId, patch);
    revalidatePath("/publicaciones");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Borra la gaceta y sus publicaciones. Se niega si alguna comparación la usa. */
export async function deleteGazetteAction(gazetteId: number): Promise<Result> {
  const denied = await requireSuper(); if (denied) return { ok: false, error: denied };
  try {
    const db = getDb()!;
    const [r] = await db<{ n: number }[]>`SELECT count(*)::int AS n FROM runs WHERE gazette_id = ${gazetteId}`;
    if (r.n > 0) return { ok: false, error: `La usan ${r.n} comparación(es). Bórralas primero en Vigilancia.` };
    await deleteGazette(gazetteId);
    revalidatePath("/publicaciones");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
