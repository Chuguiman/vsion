import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getGazetteRow } from "@/lib/gazettes";
import { listGazettePublications } from "@/lib/publications";
import PublicationsTable from "@/app/_components/PublicationsTable";

export const dynamic = "force-dynamic";

export default async function GazettePublicationsPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const s = await getSession();
  if (s?.role !== "superadmin") return notFound();
  const { id } = await params;
  const sp = await searchParams;
  const gazette = await getGazetteRow(Number(id));
  if (!gazette) return notFound();

  const q = (sp.q ?? "").trim();
  const page = Math.max(Number(sp.page ?? 1) || 1, 1);
  const data = await listGazettePublications(gazette.id, { q, page });

  return (
    <div>
      <Link href="/publicaciones"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-[var(--bd)] bg-[var(--bg2)] px-3 py-1.5 text-sm text-[var(--mut)] transition hover:border-[var(--acc)] hover:text-[var(--tx)]">
        <ArrowLeft size={16} /> Atrás
      </Link>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-xl font-semibold">Publicación {gazette.country}{gazette.number}</h1>
        <span className="text-sm text-[var(--mut)]">{data.total} marcas publicadas</span>
      </div>
      <PublicationsTable data={data} q={q} basePath={`/publicaciones/${gazette.id}`}
        emptyText="Esta gaceta no tiene publicaciones guardadas. Vuelve a cargar el archivo." />
    </div>
  );
}
