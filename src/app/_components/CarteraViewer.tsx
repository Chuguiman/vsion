"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { listCarteraMarksAction } from "../actions";
import type { CarteraMarksPage } from "@/lib/cartera";
import ZoomImage from "./ZoomImage";
import ClassChips from "./ClassChips";

export default function CarteraViewer({ orgs = [], isSuper = false }: {
  orgs?: { id: number; name: string }[];
  isSuper?: boolean;
}) {
  const [orgId, setOrgId] = useState<string>(isSuper ? (orgs.length === 1 ? String(orgs[0].id) : "") : "self");
  const [q, setQ] = useState("");
  const [onlyImages, setOnlyImages] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CarteraMarksPage | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const needsOrg = isSuper && !orgId;

  useEffect(() => {
    if (needsOrg) { setData(null); return; }
    let alive = true;
    setLoading(true);
    const org = isSuper ? Number(orgId) : null;
    listCarteraMarksAction(org, { q, page, onlyImages })
      .then((r) => { if (alive) setData(r.page ?? null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [orgId, q, page, onlyImages, isSuper, needsOrg]);

  function onSearch(v: string) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setPage(1); setQ(v); }, 300);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        {isSuper && (
          <div className="w-full max-w-xs">
            <label className="mb-1 block text-xs font-medium text-[var(--mut)]">Organización</label>
            <select value={orgId} onChange={(e) => { setPage(1); setOrgId(e.target.value); }}
              className="w-full rounded-lg border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 text-sm outline-none focus:border-[var(--acc)]">
              <option value="">Elige una organización…</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}
        <div className="relative min-w-[16rem] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mut)]" />
          <input defaultValue={q} onChange={(e) => onSearch(e.target.value)} placeholder="Buscar por marca, código, expediente o titular"
            className="w-full rounded-lg border border-[var(--bd)] bg-[var(--bg2)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--acc)]" />
        </div>
        {(data?.withImages ?? 0) > 0 && (
          <label className="inline-flex items-center gap-2 text-sm text-[var(--mut)]">
            <input type="checkbox" checked={onlyImages} onChange={(e) => { setPage(1); setOnlyImages(e.target.checked); }} />
            Solo con imagen
          </label>
        )}
      </div>

      {data && (
        <p className="mb-3 text-xs text-[var(--mut)]">
          {data.total.toLocaleString()} marcas{q ? " (filtradas)" : ""}
          {data.withImages > 0 ? ` · ${data.withImages.toLocaleString()} con imagen en cartera` : ""}
        </p>
      )}

      {needsOrg ? (
        <p className="rounded-xl border border-dashed border-[var(--bd)] px-4 py-8 text-center text-sm text-[var(--mut)]">Elige una organización para ver su cartera.</p>
      ) : loading && !data ? (
        <div className="flex items-center gap-2 px-1 py-8 text-sm text-[var(--mut)]"><Loader2 size={15} className="animate-spin" /> Cargando…</div>
      ) : data && data.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--bd)] px-4 py-8 text-center text-sm text-[var(--mut)]">Sin marcas para el filtro.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data?.rows.map((m) => (
              <div key={m.id} className="flex gap-3 rounded-xl border border-[var(--bd)] bg-[var(--bg2)] p-3">
                {m.imageUrl && (
                  <span className="shrink-0"><ZoomImage src={m.imageUrl} alt={m.denom} size={56} /></span>
                )}
                <div className="min-w-0 flex-1">
                  <div className={`truncate font-semibold ${m.denom ? "" : "italic text-[var(--mut)]"}`}>{m.denom || `(${m.markType || "figurativa"})`}</div>
                  <div className="font-mono text-[11px] text-[var(--mut)]">
                    {m.code || m.caseId || "—"}
                    {m.markType ? ` · ${m.markType}` : ""}
                    {m.status ? ` · ${m.status}` : ""}
                  </div>
                  {m.holder && <div className="truncate text-[11px] text-blue-300">{m.holder}</div>}
                  {m.classes.length > 0 && <div className="mt-1"><ClassChips classes={m.classes} pys={m.pys} /></div>}
                </div>
              </div>
            ))}
          </div>

          {data && data.pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-[var(--mut)]">
              <span>Página {data.page} de {data.pages}</span>
              <div className="flex items-center gap-2">
                <button disabled={data.page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-[var(--bd)] px-3 py-1.5 disabled:opacity-40 hover:text-[var(--tx)]">← Anterior</button>
                <button disabled={data.page >= data.pages || loading} onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-[var(--bd)] px-3 py-1.5 disabled:opacity-40 hover:text-[var(--tx)]">Siguiente →</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
