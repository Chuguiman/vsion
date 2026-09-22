import { getDb } from "./db";
import { publicImageUrl } from "./publications";

/** URLs públicas de las imágenes de cartera de una org, por código de marca. */
export async function getCarteraImageUrls(orgId: number | null, codes: string[]): Promise<Record<string, string>> {
  const db = getDb();
  const uniq = [...new Set(codes.filter(Boolean))];
  if (!db || orgId == null || !uniq.length) return {};
  const rows = await db<{ code: string; bucket: string; path: string }[]>`
    SELECT code, bucket, path FROM cartera_images
    WHERE organization_id = ${orgId} AND code = ANY(${uniq})`;
  const out: Record<string, string> = {};
  for (const r of rows) { const u = publicImageUrl(r.bucket, r.path); if (u) out[r.code] = u; }
  return out;
}
