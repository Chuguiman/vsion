import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getReviews } from "@/lib/reviews";
import { publicImageUrl } from "@/lib/publications";
import Results from "@/app/_components/Results";
import type { ReportDTO } from "@/lib/dto";

export const dynamic = "force-dynamic";

export default async function RunDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  if (!db) return notFound();

  const [row] = await db<{ payload: ReportDTO }[]>`
    SELECT payload FROM runs WHERE id = ${Number(id)}
  `;
  if (!row) return notFound();
  const session = await getSession();
  if (!session) return notFound();
  const reviews = await getReviews(Number(id));
  const canEdit = true; // workspace compartido: cualquier usuario puede revisar/exportar

  // Imágenes de las publicaciones de esta corrida (id de imagen SIC → URL pública).
  const imgRows = await db<{ image_id: string; bucket: string; path: string }[]>`
    SELECT DISTINCT p.image_id, mi.bucket, mi.path
    FROM publications p JOIN mark_images mi ON mi.image_id = p.image_id
    WHERE p.run_id = ${Number(id)} AND p.image_id IS NOT NULL AND p.image_id <> ''`;
  // El payload puede traer el id con o sin extensión → se normaliza para casar.
  const normId = (s: string) => s.replace(/\.(webp|png|jpe?g)$/i, "");
  const images: Record<string, string> = {};
  for (const r of imgRows) {
    const url = publicImageUrl(r.bucket, r.path);
    if (url) images[normId(r.image_id)] = url;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/historial" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 text-sm font-medium text-[var(--tx)] transition hover:border-[var(--acc)] hover:text-[var(--acc)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--acc)]">
          ← Ir a Vigilancia
        </Link>
        <Link href={`/runs/${id}/publicaciones`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--bd)] px-3 py-1.5 text-sm text-[var(--mut)] hover:text-[var(--tx)]">
          Ver publicación completa →
        </Link>
      </div>
      <Results dto={row.payload} runId={Number(id)} reviews={reviews} canEdit={canEdit} images={images} />
    </div>
  );
}
