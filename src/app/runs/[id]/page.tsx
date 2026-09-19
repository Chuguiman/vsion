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
      <Link href="/historial" className="mb-4 inline-block text-sm text-[var(--mut)] hover:text-[var(--tx)]">
        ← Vigilancia
      </Link>
      <Results dto={row.payload} runId={Number(id)} reviews={reviews} canEdit={canEdit} />
    </div>
  );
}
