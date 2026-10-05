import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { listPublications } from "@/lib/publications";
import PublicationsTable from "@/app/_components/PublicationsTable";

export const dynamic = "force-dynamic";

export default async function PublicacionesPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const runId = Number(id);
  const db = getDb();
  if (!db) return notFound();
  const session = await getSession();
  if (!session) return notFound();

  const [run] = await db<{ country: string; gazette_number: string; organization_id: number | null }[]>`
    SELECT country, gazette_number, organization_id FROM runs WHERE id = ${runId}`;
  if (!run) return notFound();
  // Aislamiento: solo el superadmin (o la propia organización) puede ver la publicación.
  if (session.role !== "superadmin" && Number(run.organization_id) !== session.organizationId) return notFound();

  const q = (sp.q ?? "").trim();
  const page = Math.max(Number(sp.page ?? 1) || 1, 1);
  const data = await listPublications(runId, { q, page });

  return (
    <div>
      <Link href={`/runs/${runId}`}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-[var(--bd)] bg-[var(--bg2)] px-3 py-1.5 text-sm text-[var(--mut)] transition hover:border-[var(--acc)] hover:text-[var(--tx)]">
        <ArrowLeft size={16} /> Atrás
      </Link>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-xl font-semibold">Publicación {run.country}{run.gazette_number}</h1>
        <span className="text-sm text-[var(--mut)]">{data.total} marcas publicadas</span>
      </div>

      <PublicationsTable data={data} q={q} basePath={`/runs/${runId}/publicaciones`}
        emptyText="Esta corrida no tiene la publicación completa guardada (es anterior a esta función). Vuelve a procesar la gaceta para verla aquí." />
    </div>
  );
}
