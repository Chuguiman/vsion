import { getDb } from "./db";
import type { PublicationRow } from "@/load";

export interface PubRecord {
  id: number;
  seq: number;
  denom: string;
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

/** Guarda todas las publicaciones de una gaceta (reemplaza las del run). */
export async function savePublications(runId: number, rows: PublicationRow[]): Promise<void> {
  const db = getDb();
  if (!db || !rows.length) return;
  await db`DELETE FROM publications WHERE run_id = ${runId}`;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK).map((r) => ({
      run_id: runId, seq: r.seq, denom: r.denom, classes: r.classes, pys: r.pys,
      applicant: r.applicant, applicant_country: r.applicantCountry, representant: r.representant,
      application_number: r.applicationNumber, application_date: r.applicationDate,
      mark_type: r.markType, status: r.status, image_id: r.imageId,
    }));
    await db`INSERT INTO publications ${db(batch,
      "run_id", "seq", "denom", "classes", "pys", "applicant", "applicant_country",
      "representant", "application_number", "application_date", "mark_type", "status", "image_id")}`;
  }
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
  const pageSize = Math.min(Math.max(opts.pageSize ?? 40, 10), 100);
  const page = Math.max(opts.page ?? 1, 1);
  const offset = (page - 1) * pageSize;
  const empty: PubPage = { rows: [], total: 0, page, pageSize, pages: 0 };
  if (!db) return empty;

  const q = (opts.q ?? "").trim();
  const filter = q
    ? db`AND (denom ILIKE ${"%" + q + "%"} OR applicant ILIKE ${"%" + q + "%"} OR application_number ILIKE ${"%" + q + "%"})`
    : db``;

  const [{ n }] = await db<{ n: number }[]>`
    SELECT count(*)::int AS n FROM publications WHERE run_id = ${runId} ${filter}`;
  const rows = await db<PubRecord[]>`
    SELECT p.id, p.seq, p.denom, p.classes, p.pys, p.applicant, p.applicant_country, p.representant,
           p.application_number, p.application_date, p.mark_type, p.status, p.image_id,
           mi.bucket AS image_bucket, mi.path AS image_path
    FROM publications p
    LEFT JOIN mark_images mi ON mi.image_id = p.image_id
    WHERE p.run_id = ${runId} ${filter}
    ORDER BY p.seq LIMIT ${pageSize} OFFSET ${offset}`;
  return { rows, total: n, page, pageSize, pages: Math.max(1, Math.ceil(n / pageSize)) };
}

export async function publicationCount(runId: number): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const [r] = await db<{ n: number }[]>`SELECT count(*)::int AS n FROM publications WHERE run_id = ${runId}`;
  return r?.n ?? 0;
}
