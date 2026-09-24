"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2, ArrowLeft, ChevronDown, Check } from "lucide-react";
import { getMarkMatchesAction, listCarteraMarksAction, type MarkMatch } from "../actions";
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
  const [selectedMark, setSelectedMark] = useState<CarteraMarksPage["rows"][number] | null>(null);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const needsOrg = isSuper && !orgId;
  const selectedOrgName = orgs.find((o) => String(o.id) === orgId)?.name ?? "Elige una organización…";

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

  useEffect(() => {
    if (!orgMenuOpen) return;
    const close = () => setOrgMenuOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [orgMenuOpen]);

  function onSearch(v: string) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setPage(1); setQ(v); }, 300);
  }

  function closeDetail() {
    setSelectedMark(null);
  }

  if (selectedMark) return <MarkDetail mark={selectedMark} onBack={closeDetail} />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        {isSuper && (
          <div className="w-full max-w-xs">
            <label className="mb-1 block text-xs font-medium text-[var(--mut)]">Organización</label>
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button type="button" aria-haspopup="listbox" aria-expanded={orgMenuOpen}
                onClick={() => setOrgMenuOpen((open) => !open)}
                className={`flex w-full items-center justify-between rounded-lg border bg-[var(--bg2)] px-3 py-2 text-left text-sm outline-none transition ${orgMenuOpen ? "border-[var(--acc)] ring-2 ring-[var(--acc)]/20" : "border-[var(--bd)] hover:border-[var(--acc)]"}`}>
                <span className={orgId ? "text-[var(--tx)]" : "text-[var(--mut)]"}>{selectedOrgName}</span>
                <ChevronDown size={16} className={`shrink-0 text-[var(--mut)] transition-transform ${orgMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {orgMenuOpen && (
                <div role="listbox" aria-label="Organización" className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-lg border border-[var(--bd)] bg-[var(--bg2)] p-1 shadow-xl shadow-black/30">
                  <OrgOption label="Elige una organización…" value="" selected={orgId === ""} onSelect={() => { setPage(1); setOrgId(""); setOrgMenuOpen(false); }} />
                  {orgs.map((o) => <OrgOption key={o.id} label={o.name} value={String(o.id)} selected={orgId === String(o.id)} onSelect={() => { setPage(1); setOrgId(String(o.id)); setOrgMenuOpen(false); }} />)}
                </div>
              )}
            </div>
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
              <div key={m.id} role="button" tabIndex={0}
                onClick={() => setSelectedMark(m)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedMark(m); } }}
                className="group flex cursor-pointer gap-3 rounded-xl border border-[var(--bd)] bg-[var(--bg2)] p-3 transition hover:border-[var(--acc)] hover:shadow-lg hover:shadow-black/10 focus:outline-none focus:ring-2 focus:ring-[var(--acc)]">
                {m.imageUrl && (
                  <span className="shrink-0" onClick={(e) => e.stopPropagation()}><ZoomImage src={m.imageUrl} alt={m.denom} size={56} /></span>
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
                  <div className="mt-2 text-[11px] font-medium text-[var(--acc)] opacity-70 transition group-hover:opacity-100 group-focus:opacity-100">Ver detalle →</div>
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

function OrgOption({ label, value, selected, onSelect }: { label: string; value: string; selected: boolean; onSelect: () => void }) {
  return <button type="button" role="option" aria-selected={selected} onClick={onSelect}
    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${selected ? "bg-[var(--acc)]/15 text-[var(--tx)]" : "text-[var(--mut)] hover:bg-white/5 hover:text-[var(--tx)]"}`}>
    <span>{label}</span>{selected && <Check size={15} className="text-[var(--acc)]" />}
  </button>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-[var(--bd)] py-3 last:border-0"><div className="text-[11px] text-[var(--mut)]">{label}</div><div className="mt-1 text-sm font-medium">{value}</div></div>;
}

type MarkDetailProps = { mark: CarteraMarksPage["rows"][number]; onBack: () => void };

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function matchScoreColor(score: number) {
  const t = Math.max(0, Math.min(1, (score - 55) / 45));
  return `hsl(${210 - 210 * t}, 78%, 58%)`;
}

function MatchChips({ values, tone = "default" }: { values: number[]; tone?: "default" | "match" | "related" }) {
  if (!values.length) return <span className="text-[11px] text-[var(--mut)]">—</span>;
  const style = tone === "match" ? "border-[var(--acc)] bg-[var(--acc)]/10 text-[var(--acc)]" : tone === "related" ? "border-amber-500/50 bg-amber-500/10 text-amber-400" : "border-[var(--bd)] text-[var(--mut)]";
  return <span className="inline-flex flex-wrap gap-1">{values.map((value) => <span key={value} className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${style}`}>{value}</span>)}</span>;
}

function WatchMatches({ matches, loading, markTitle }: { matches: MarkMatch[] | null; loading: boolean; markTitle: string }) {
  if (loading) return <div className="rounded-xl border border-[var(--bd)] bg-[var(--bg2)] p-6 text-sm text-[var(--mut)]">Cargando comparaciones…</div>;
  if (!matches?.length) return <article className="rounded-xl border border-[var(--bd)] bg-[var(--bg2)] p-6"><h2 className="text-sm font-semibold">Vigilancia</h2><p className="mt-3 text-xs text-[var(--mut)]">Esta marca todavía no aparece como hit/match en ninguna comparación.</p></article>;

  return <div>
    <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-base font-semibold">Matches obtenidos</h2><p className="mt-1 text-xs text-[var(--mut)]">Comparaciones donde esta marca fue retenida por similitud.</p></div><span className="rounded-md border border-[var(--acc)]/40 bg-[var(--acc)]/10 px-2.5 py-1 font-mono text-sm font-semibold text-[var(--acc)]">{matches.length} hits</span></div>
    <div className="space-y-4">
      {matches.map((match) => <article key={`${match.runId}-${match.applicationNumber}-${match.score}`} className="overflow-hidden rounded-xl border border-[var(--bd)] bg-[var(--bg2)]">
        <header className="border-b border-[var(--bd)] px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-semibold">{match.publicationDenom}</h3><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--mut)]"><span className="font-mono">{match.applicationNumber || `${match.country}${match.gazetteNumber}`}</span><span>{match.markType || "Marca"}</span>{match.applicant && <span>Solicitante: {match.applicant}</span>}{match.representant && <span>Apoderado: <b className="font-medium text-teal-300">{match.representant}</b></span>}</div></div><span className="shrink-0 text-right"><b className="font-mono text-xl" style={{ color: matchScoreColor(match.score) }}>{match.score}</b><small className="block text-[10px] text-[var(--mut)]">score</small></span></div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--mut)]"><span>Gaceta {match.country}{match.gazetteNumber}</span><span>·</span><span>{match.datePublic ? formatDate(match.datePublic) : "Fecha no informada"}</span><span>· Clases publicación:</span><MatchChips values={match.publicationClasses} /></div>
        </header>
        <div className="grid gap-4 p-4 sm:grid-cols-[5rem_minmax(0,1fr)_10rem_11rem] sm:items-start sm:px-5">
          <div><span className="mr-1 inline-block h-1.5 w-12 overflow-hidden rounded bg-[var(--bd)] align-middle"><span className="block h-full" style={{ width: `${match.score}%`, background: matchScoreColor(match.score) }} /></span><b className="font-mono text-sm" style={{ color: matchScoreColor(match.score) }}>{match.score}</b></div>
          <div className="min-w-0"><div className="text-[10px] uppercase tracking-wide text-[var(--mut)]">Marca de la cartera</div><div className="mt-1 truncate text-sm font-semibold">{markTitle}</div><div className="font-mono text-[11px] text-[var(--mut)]">{match.clientClasses.length ? `Clases: ${match.clientClasses.join(" · ")}` : "Sin clases"}</div></div>
          <div><div className="text-[10px] uppercase tracking-wide text-[var(--mut)]">Clases coincidentes</div><div className="mt-2"><MatchChips values={match.matchingClasses} tone="match" />{match.relatedClasses.length > 0 && <div className="mt-1"><MatchChips values={match.relatedClasses} tone="related" /></div>}</div></div>
          <div><div className="text-[10px] uppercase tracking-wide text-[var(--mut)]">Relación</div><div className="mt-2"><span className={`rounded px-2 py-1 text-[11px] font-semibold ${match.relation === "conflict" ? "bg-red-500/15 text-red-300" : match.relation === "firm" ? "bg-violet-500/15 text-violet-300" : "bg-blue-500/15 text-blue-300"}`}>{match.relation === "conflict" ? (match.aiRecommendation === "file_opposition" ? "Oponerse" : match.aiRecommendation === "monitor_closely" ? "Vigilar" : "Conflicto") : match.relation === "firm" ? "Tu firma" : "Tu marca"}</span>{match.aiProb != null && <span className="ml-1 text-[11px] text-[var(--mut)]">{match.aiProb}%</span>}</div>{match.aiSummary && <details className="mt-2"><summary className="cursor-pointer text-[11px] text-[var(--acc)]">análisis</summary><p className="mt-1 text-[11px] leading-4 text-[var(--mut)]">{match.aiSummary}</p></details>}</div>
        </div>
        {(match.reviewStatus || match.reviewer) && <div className="border-t border-[var(--bd)] px-4 py-2 text-[10px] text-[var(--mut)] sm:px-5">Revisión: <span className="font-medium text-[var(--tx)]">{match.reviewStatus === "approved" ? "Aprobado" : match.reviewStatus === "discarded" ? "Descartado" : "Pendiente"}</span>{match.reviewer ? ` por ${match.reviewer}` : ""}</div>}
      </article>)}
    </div>
  </div>;
}

function MarkDetail({ mark, onBack }: MarkDetailProps) {
  const [tab, setTab] = useState("Resumen");
  const [matches, setMatches] = useState<MarkMatch[] | null>(null);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const tabs = ["Resumen", "Historial", "Documentos", "Vigilancia", "Relaciones"];
  const title = mark.denom || `(${mark.markType || "Marca figurativa"})`;

  useEffect(() => {
    if (!mark.code) { setMatches([]); return; }
    let alive = true;
    setMatchesLoading(true);
    getMarkMatchesAction(mark.code)
      .then((r) => { if (alive) setMatches(r.matches ?? []); })
      .finally(() => { if (alive) setMatchesLoading(false); });
    return () => { alive = false; };
  }, [mark.code]);

  return (
    <div className="max-w-6xl">
      <div className="mb-5 flex items-center gap-2 text-xs text-[var(--mut)]">
        <button type="button" onClick={onBack} className="hover:text-[var(--tx)]">Marcas</button>
        <span>/</span><span>{mark.country || "Registro"}</span><span>/</span><strong className="font-medium text-[var(--tx)]">{mark.code || title}</strong>
      </div>

      <div className="mb-6 flex flex-col justify-between gap-5 md:flex-row md:items-start">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[.16em] text-[var(--mut)]">Expediente de marca · {mark.country || "País no informado"}</div>
          <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            {mark.status && <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">● {mark.status}</span>}
            {mark.markType && <span className="rounded-md border border-[var(--bd)] px-2.5 py-1 text-xs text-[var(--mut)]">{mark.markType}</span>}
            <span className="rounded-md border border-[var(--bd)] px-2.5 py-1 text-xs text-[var(--mut)]">Clases {mark.classes.length ? mark.classes.join(" · ") : "sin dato"}</span>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={onBack} className="rounded-lg border border-[var(--bd)] px-3 py-2 text-xs font-medium hover:border-[var(--acc)]">Volver a marcas</button>
        </div>
      </div>

      <div className="mb-6 grid overflow-hidden rounded-xl border border-[var(--bd)] bg-[var(--bg2)] md:grid-cols-[1.25fr_1fr_.9fr]">
        <Summary label="Titular" value={mark.holder || "Sin dato"} hint={mark.country || "Titular no informado"} />
        <Summary label="Número de solicitud / expediente" value={mark.code || "Sin dato"} hint="Identificador principal del registro" divided />
        <Summary label="Próxima acción" value="Revisar novedades" hint="La fuente no informa una acción pendiente" tone />
      </div>

      <div className="mb-6 flex gap-6 overflow-x-auto border-b border-[var(--bd)]" role="tablist">
        {tabs.map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`whitespace-nowrap border-b-2 px-1 pb-3 text-xs font-semibold ${tab === item ? "border-[var(--tx)] text-[var(--tx)]" : "border-transparent text-[var(--mut)]"}`}>{item}</button>)}
      </div>

      {tab === "Resumen" ? <>
        <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-5">
            <article className="rounded-xl border border-[var(--bd)] bg-[var(--bg2)] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">Vida del expediente</h2><span className="text-[11px] text-[var(--mut)]">Datos disponibles en la fuente</span></div>
              <div className="relative mt-7 grid grid-cols-4 gap-2">
                <span className="absolute left-[10%] right-[10%] top-3 h-px bg-[var(--bd)]" aria-hidden="true" />
                {[
                  ["Radicada", mark.filedDate ? formatDate(mark.filedDate) : "Sin fecha", Boolean(mark.filedDate)],
                  ["Registrada", mark.registerDate ? formatDate(mark.registerDate) : "Pendiente", Boolean(mark.registerDate)],
                  ["Vigencia", mark.validUntil ? formatDate(mark.validUntil) : "Sin dato", Boolean(mark.validUntil)],
                  ["Estado actual", mark.status || "Pendiente", Boolean(mark.status)],
                ].map(([label, hint, done], i) => <div key={String(label)} className="relative z-[1] min-w-0 text-center"><span className={`mx-auto mb-3 grid h-7 w-7 place-items-center rounded-full border-4 border-[var(--bg2)] text-[10px] font-semibold ${done ? "bg-[var(--acc)] text-[var(--bg)]" : "bg-[var(--bg)] text-[var(--mut)] ring-1 ring-[var(--bd)]"}`}>{i + 1}</span><strong className="block text-[9px] uppercase tracking-wide sm:text-[10px]">{label}</strong><small className="mt-1 block truncate text-[9px] text-[var(--mut)] sm:text-[10px]">{hint}</small></div>)}
              </div>
              <div className="mt-6 flex items-start gap-3 border-t border-[var(--bd)] pt-4"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400">↗</span><div><b className="block text-xs">Registro en cartera</b><small className="mt-1 block text-[11px] text-[var(--mut)]">La fuente no informa fechas de vigencia ni resolución.</small></div></div>
            </article>
            <article className="rounded-xl border border-[var(--bd)] bg-[var(--bg2)] p-5 sm:p-6"><h2 className="mb-4 text-sm font-semibold">Datos del registro</h2><div className="grid gap-x-8 sm:grid-cols-2"><DetailRow label="Número de solicitud / expediente" value={mark.code || "Sin dato"} /><DetailRow label="Referencia SIC" value={mark.caseId || "Sin dato"} /><DetailRow label="Denominación" value={title} /><DetailRow label="Tipo de signo" value={mark.markType || "Sin dato"} /><DetailRow label="Clasificación" value={mark.classes.length ? `Niza ${mark.classes.join(", ")}` : "Sin dato"} /><DetailRow label="Estado" value={mark.status || "Sin dato"} /></div></article>
            <article className="rounded-xl border border-[var(--bd)] bg-[var(--bg2)] p-5 sm:p-6"><h2 className="mb-4 text-sm font-semibold">Derechos y cobertura</h2>{mark.classes.length ? mark.classes.map((n) => <div key={n} className="mb-4 flex gap-3 last:mb-0"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--acc)] text-sm font-semibold text-[var(--bg)]">{n}</span><div><h3 className="text-xs font-semibold">Clase {n}</h3><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-[var(--mut)]">{mark.pys || "La descripción de productos y servicios no está disponible en el registro."}</p></div></div>) : <p className="text-xs text-[var(--mut)]">No hay clases Niza informadas.</p>}</article>
          </div>
          <aside className="space-y-5">
            <article className="rounded-xl border border-[var(--bd)] bg-[var(--bg2)] p-5"><h2 className="mb-4 text-sm font-semibold">Titular</h2><p className="text-xs font-semibold">{mark.holder || "Sin dato"}</p><p className="mt-2 text-[11px] text-[var(--mut)]">{mark.country || "País no informado"}</p></article>
            <article className="rounded-xl border border-[var(--bd)] bg-[var(--bg2)] p-5"><h2 className="mb-4 text-sm font-semibold">Apoderado / representante</h2><p className="text-xs font-semibold">{mark.attorney || "Sin dato"}</p></article>
            <article className="rounded-xl border border-[var(--bd)] bg-[var(--bg2)] p-5"><h2 className="mb-4 text-sm font-semibold">Imagen de marca</h2>{mark.imageUrl ? <ZoomImage src={mark.imageUrl} alt={title} size={180} /> : <div className="grid h-32 place-items-center rounded-lg border border-dashed border-[var(--bd)] text-xs text-[var(--mut)]">Imagen no adjunta</div>}<p className="mt-3 text-[11px] text-[var(--mut)]">La imagen corresponde al archivo disponible en la cartera.</p></article>
          </aside>
        </div>
      </> : tab === "Vigilancia" ? <WatchMatches matches={matches} loading={matchesLoading} markTitle={title} /> : <article className="rounded-xl border border-[var(--bd)] bg-[var(--bg2)] p-6"><h2 className="text-sm font-semibold">{tab}</h2><p className="mt-3 text-xs text-[var(--mut)]">No hay información adicional disponible para esta sección del registro.</p></article>}
    </div>
  );
}

function Summary({ label, value, hint, divided = false, tone = false }: { label: string; value: string; hint: string; divided?: boolean; tone?: boolean }) {
  return <div className={`${divided ? "border-t md:border-l md:border-t-0" : ""} ${tone ? "bg-[var(--acc)]/10" : ""} min-w-0 p-5`}><div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mut)]">{label}</div><div className="mt-2 truncate text-sm font-semibold">{value}</div><small className="mt-1 block truncate text-[11px] text-[var(--mut)]">{hint}</small></div>;
}
