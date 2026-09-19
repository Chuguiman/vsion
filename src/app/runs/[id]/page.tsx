import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getReviews } from "@/lib/reviews";
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

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/historial" className="inline-block text-sm text-[var(--mut)] hover:text-[var(--tx)]">
          ← Vigilancia
        </Link>
        <Link href={`/runs/${id}/publicaciones`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--bd)] px-3 py-1.5 text-sm text-[var(--mut)] hover:text-[var(--tx)]">
          Ver publicación completa →
        </Link>
      </div>
      <Results dto={row.payload} runId={Number(id)} reviews={reviews} canEdit={canEdit} />
    </div>
  );
}
