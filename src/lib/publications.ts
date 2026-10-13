import { getDb } from "./db";
import { computeKeys } from "@/phonetics";
import type { PublicationRow } from "@/load";
import type { GazetteEntry } from "@/types";

export interface PubRecord {
  id: number;
  seq: number;
  denom: string;
  mark_category: string | null;
  classes: number[];
  pys: string | null;
  applicant: string | null;
  applicant_country: string | null;
  representant: string | null;
  application_number: string | null;
  application_date: string | null;
  mark_type: string | null;
  status: string | null;
  image_id: string | null;
  image_bucket: string | null;
  image_path: string | null;   // ruta del objeto dentro del bucket (mark_images)
}

/** URL pública de una imagen en Supabase Storage. */
export function publicImageUrl(bucket: string | null, objectPath: string | null): string | null {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  if (!base || !bucket || !objectPath) return null;
  return `${base}/storage/v1/object/public/${bucket}/${objectPath}`;
}

/** Guarda todas las publicaciones de una gaceta (reemplaza las de esa gaceta). */
export async function savePublications(gazetteId: number, rows: PublicationRow[]): Promise<void> {
  const db = getDb();
  if (!db || !rows.length) return;
  await db`DELETE FROM publications WHERE gazette_id = ${gazetteId}`;
  await insertPublications(gazetteId, rows);
}

/** Añade publicaciones a una gaceta (subida por lotes desde el navegador). */
export async function insertPublications(gazetteId: number, rows: PublicationRow[]): Promise<void> {
  const db = getDb();
  if (!db || !rows.length) return;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK).map((r) => ({
      gazette_id: gazetteId, seq: r.seq, denom: r.denom, mark_category: r.markCategory, classes: r.classes, pys: r.pys,
      applicant: r.applicant, applicant_country: r.applicantCountry, representant: r.representant,
      application_number: r.applicationNumber, application_date: r.applicationDate,
      mark_type: r.markType, status: r.status, image_id: r.imageId,
    }));
    await db`INSERT INTO publications ${db(batch,
      "gazette_id", "seq", "denom", "mark_category", "classes", "pys", "applicant", "applicant_country",
      "representant", "application_number", "application_date", "mark_type", "status", "image_id")}`;
  }
}

/** gazette_id del run (null si es legado sin normalizar). */
async function runGazetteId(db: NonNullable<ReturnType<typeof getDb>>, runId: number): Promise<number | null> {
  const [r] = await db<{ gazette_id: number | null }[]>`SELECT gazette_id FROM runs WHERE id = ${runId}`;
  return r?.gazette_id ?? null;
}

export interface PubPage {
  rows: PubRecord[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

/** Lista paginada de publicaciones de un run, con búsqueda opcional. */
export async function listPublications(
  runId: number, opts: { q?: string; page?: number; pageSize?: number } = {}
): Promise<PubPage> {
  const db = getDb();
  if (!db) return { rows: [], total: 0, page: Math.max(opts.page ?? 1, 1), pageSize: 40, pages: 0 };
  const gid = await runGazetteId(db, runId);
  return queryPublications(gid != null ? db`p.gazette_id = ${gid}` : db`p.run_id = ${runId}`, opts);
}

/** Lista paginada de publicaciones de una gaceta (CRUD de publicaciones). */
export async function listGazettePublications(
  gazetteId: number, opts: { q?: string; page?: number; pageSize?: number } = {}
): Promise<PubPage> {
  const db = getDb();
  if (!db) return { rows: [], total: 0, page: Math.max(opts.page ?? 1, 1), pageSize: 40, pages: 0 };
  return queryPublications(db`p.gazette_id = ${gazetteId}`, opts);
}

async function queryPublications(
  scope: ReturnType<NonNullable<ReturnType<typeof getDb>>>, opts: { q?: string; page?: number; pageSize?: number }
): Promise<PubPage> {
  const db = getDb()!;
  const pageSize = Math.min(Math.max(opts.pageSize ?? 40, 10), 100);
  const page = Math.max(opts.page ?? 1, 1);
  const offset = (page - 1) * pageSize;
  const q = (opts.q ?? "").trim();
  const filter = q
    ? db`AND (denom ILIKE ${"%" + q + "%"} OR applicant ILIKE ${"%" + q + "%"} OR application_number ILIKE ${"%" + q + "%"})`
    : db``;

  const [{ n }] = await db<{ n: number }[]>`
    SELECT count(*)::int AS n FROM publications p WHERE ${scope} ${filter}`;
  const rows = await db<PubRecord[]>`
    SELECT p.id, p.seq, p.denom, p.mark_category, p.classes, p.pys, p.applicant, p.applicant_country, p.representant,
           p.application_number, p.application_date, p.mark_type, p.status, p.image_id,
           mi.bucket AS image_bucket, mi.path AS image_path
    FROM publications p
    LEFT JOIN mark_images mi ON mi.image_id IN (p.image_id, p.image_id || '.webp') -- la gaceta puede traer el id sin extensión
    WHERE ${scope} ${filter}
    ORDER BY p.seq LIMIT ${pageSize} OFFSET ${offset}`;
  return { rows, total: n, page, pageSize, pages: Math.max(1, Math.ceil(n / pageSize)) };
}

/**
 * Reconstruye las entradas de la gaceta (para el barrido) desde las publicaciones
 * ya guardadas. Descarta denominaciones vacías (figurativas), como parseGazette.
 */
export async function loadGazetteEntries(gazetteId: number): Promise<GazetteEntry[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db<{
    denom: string; classes: number[] | null; pys: string | null;
    applicant: string | null; applicant_country: string | null; representant: string | null;
    application_number: string | null; application_date: string | null;
    mark_type: string | null; status: string | null; image_id: string | null;
  }[]>`
    SELECT denom, classes, pys, applicant, applicant_country, representant,
           application_number, application_date, mark_type, status, image_id
    FROM publications WHERE gazette_id = ${gazetteId} ORDER BY seq`;
  const entries: GazetteEntry[] = [];
  for (const r of rows) {
    const denom = (r.denom ?? "").trim();
    if (!denom) continue;
    entries.push({
      denom,
      classes: r.classes ?? [],
      pys: r.pys ?? "",
      applicant: r.applicant ?? "",
      applicantCountry: (r.applicant_country ?? "").toUpperCase(),
      representant: r.representant ?? "",
      applicationNumber: r.application_number ?? "",
      applicationDate: r.application_date ?? "",
      priority: "",
      markType: r.mark_type ?? "",
      status: r.status ?? "",
      image: r.image_id ?? "",
      keys: computeKeys(denom),
    });
  }
  return entries;
}

export async function publicationCount(runId: number): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const gid = await runGazetteId(db, runId);
  const scope = gid != null ? db`p.gazette_id = ${gid}` : db`p.run_id = ${runId}`;
  const [r] = await db<{ n: number }[]>`SELECT count(*)::int AS n FROM publications p WHERE ${scope}`;
  return r?.n ?? 0;
}
