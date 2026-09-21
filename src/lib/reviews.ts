import { getDb } from "./db";

export type ReviewStatus = "approved" | "discarded";

/** Quién tomó la decisión (para atribución en workspace compartido). */
export interface Reviewer {
  id: number | null;
  name: string | null;
}

export interface RunReviews {
  /** candKey → estado (base para filtros y export). */
  statuses: Record<string, ReviewStatus>;
  /** candKey → nombre de quién revisó (solo para mostrar). */
  reviewers: Record<string, string>;
}

/** Estados + atribución de una corrida. */
export async function getReviews(runId: number): Promise<RunReviews> {
  const db = getDb();
  if (!db) return { statuses: {}, reviewers: {} };
  const rows = await db<{ cand_key: string; status: ReviewStatus; reviewer_name: string | null }[]>`
    SELECT cand_key, status, reviewer_name FROM reviews WHERE run_id = ${runId}
  `;
  const statuses: Record<string, ReviewStatus> = {};
  const reviewers: Record<string, string> = {};
  for (const r of rows) {
    statuses[r.cand_key] = r.status;
    if (r.reviewer_name) reviewers[r.cand_key] = r.reviewer_name;
  }
  return { statuses, reviewers };
}

/** Fija o limpia (status null) la decisión de un candidato, registrando quién la tomó. */
export async function setReview(
  runId: number,
  candKey: string,
  status: ReviewStatus | null,
  reviewer?: Reviewer,
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Sin base de datos.");
  if (status === null) {
    await db`DELETE FROM reviews WHERE run_id = ${runId} AND cand_key = ${candKey}`;
    return;
  }
  const by = reviewer?.id ?? null;
  const byName = reviewer?.name ?? null;
  await db`
    INSERT INTO reviews (run_id, cand_key, status, reviewed_by, reviewer_name, updated_at)
    VALUES (${runId}, ${candKey}, ${status}, ${by}, ${byName}, now())
    ON CONFLICT (run_id, cand_key)
      DO UPDATE SET status = ${status}, reviewed_by = ${by}, reviewer_name = ${byName}, updated_at = now()
  `;
}

/** Fija un mismo estado a MUCHOS candidatos en una sola escritura (acción masiva). */
export async function setReviewsBulk(
  runId: number,
  candKeys: string[],
  status: ReviewStatus,
  reviewer?: Reviewer,
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Sin base de datos.");
  if (!candKeys.length) return;
  const by = reviewer?.id ?? null;
  const byName = reviewer?.name ?? null;
  const rows = candKeys.map((k) => ({
    run_id: runId, cand_key: k, status, reviewed_by: by, reviewer_name: byName,
  }));
  await db`
    INSERT INTO reviews ${db(rows, "run_id", "cand_key", "status", "reviewed_by", "reviewer_name")}
    ON CONFLICT (run_id, cand_key) DO UPDATE SET
      status = excluded.status, reviewed_by = excluded.reviewed_by,
      reviewer_name = excluded.reviewer_name, updated_at = now()
  `;
}
