import Link from "next/link";
import { publicImageUrl, type PubPage } from "@/lib/publications";
import ZoomImage from "./ZoomImage";

/** Buscador + tabla paginada de publicaciones (compartido por corrida y por gaceta). */
export default function PublicationsTable({ data, q, basePath, emptyText }: {
  data: PubPage; q: string; basePath: string; emptyText: string;
}) {
  const { rows, total, pages, pageSize, page } = data;
  const hrefFor = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return `${basePath}${s ? `?${s}` : ""}`;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <>
      <form className="mb-4 flex gap-2" action={basePath}>
        <input name="q" defaultValue={q} placeholder="Buscar por marca, solicitante o expediente"
          className="w-full max-w-md rounded-lg border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 text-sm outline-none focus:border-[var(--acc)]" />
        <button className="rounded-lg bg-[var(--acc)] px-4 py-2 text-sm font-medium text-white">Buscar</button>
        {q && <Link href={hrefFor(1)} className="rounded-lg border border-[var(--bd)] px-3 py-2 text-sm text-[var(--mut)] hover:text-[var(--tx)]">Limpiar</Link>}
      </form>

      {total === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--bd)] px-4 py-8 text-center text-sm text-[var(--mut)]">
          {q ? "Sin resultados para la búsqueda." : emptyText}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-[var(--bd)] bg-[var(--bg2)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-[var(--mut)]">
                  <th className="px-3 py-2 font-medium">Expediente · Categoría · Tipo · Estado</th>
                  <th className="px-3 py-2 font-medium">Img</th>
                  <th className="px-3 py-2 font-medium">Marca</th>
                  <th className="px-3 py-2 font-medium">Clases</th>
                  <th className="px-3 py-2 font-medium">Solicitante / Apoderado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const img = publicImageUrl(r.image_bucket, r.image_path);
                  return (
                  <tr key={r.id} className="border-b border-[var(--bd)] last:border-0 align-top hover:bg-white/5">
                    <td className="px-3 py-2 text-[12px]">
                      <span className="block font-mono text-[var(--tx)]">{r.application_number || "—"}</span>
                      <span className="mt-0.5 block text-[var(--mut)]">
                        {[r.mark_category, r.mark_type, r.status].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {img ? <ZoomImage src={img} alt={r.denom || "Figurativa"} /> : <span className="text-[var(--mut)]">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={r.denom ? "font-semibold" : "font-semibold text-[var(--mut)] italic"}>
                        {r.denom || "(figurativa)"}
                      </span>
                      {r.pys && <span className="mt-0.5 block max-w-md truncate text-[11px] text-[var(--mut)]">{r.pys}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex flex-wrap gap-1">
                        {r.classes.length ? r.classes.map((n) => (
                          <span key={n} className="rounded border border-[var(--bd)] px-1.5 font-mono text-[11px] text-[var(--mut)]">{n}</span>
                        )) : <span className="text-[var(--mut)]">—</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="block">{r.applicant || "—"}
                        {r.applicant_country && <span className="ml-1 text-[11px] text-[var(--mut)]">({r.applicant_country})</span>}</span>
                      {r.representant && <span className="mt-0.5 block text-[11px] text-teal-300">Apod.: {r.representant}</span>}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-[var(--mut)]">
            <span>{from}–{to} de {total}</span>
            <div className="flex items-center gap-2">
              {page > 1 && <Link href={hrefFor(page - 1)} className="rounded-lg border border-[var(--bd)] px-3 py-1.5 hover:text-[var(--tx)]">← Anterior</Link>}
              <span>Página {page} de {pages}</span>
              {page < pages && <Link href={hrefFor(page + 1)} className="rounded-lg border border-[var(--bd)] px-3 py-1.5 hover:text-[var(--tx)]">Siguiente →</Link>}
            </div>
          </div>
        </>
      )}
    </>
  );
}
