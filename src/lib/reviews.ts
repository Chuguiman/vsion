import { getDb } from "./db";

export type ReviewStatus = "approved" | "discarded";

/** Mapa candKey → estado, para una corrida. */
export async function getReviews(runId: number): Promise<Record<string, ReviewStatus>> {
  const db = getDb();
  if (!db) return {};
  const rows = await db<{ cand_key: string; status: ReviewStatus }[]>`
    SELECT cand_key, status FROM reviews WHERE run_id = ${runId}
  `;
  const out: Record<string, ReviewStatus> = {};
  for (const r of rows) out[r.cand_key] = r.status;
  return out;
}

/** Fija o limpia (status null) la decisión de un candidato. */
export async function setReview(runId: number, candKey: string, status: ReviewStatus | null): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Sin base de datos.");
  if (status === null) {
    await db`DELETE FROM reviews WHERE run_id = ${runId} AND cand_key = ${candKey}`;
    return;
  }
  await db`
    INSERT INTO reviews (run_id, cand_key, status, updated_at)
    VALUES (${runId}, ${candKey}, ${status}, now())
    ON CONFLICT (run_id, cand_key) DO UPDATE SET status = ${status}, updated_at = now()
  `;
}
