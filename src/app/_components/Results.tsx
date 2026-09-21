"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, Loader2, Check, X, Download, ChevronDown } from "lucide-react";
import type { ReportDTO, PubDTO, CandDTO, Relation, AiVerdict } from "@/lib/dto";
import { analyzeBatchAction, setReviewAction, setReviewsBulkAction, getReviewsAction } from "../actions";
import type { ReviewStatus } from "@/lib/reviews";
import { useRealtimeReviews } from "./useRealtimeReviews";
import BarcodeStat, { type Seg } from "./BarcodeStat";
import CandCard from "./CandCard";
import ClassChips from "./ClassChips";
import ZoomImage from "./ZoomImage";

const C = { red: "#ef4444", amber: "#f59e0b", blue: "#3b82f6", violet: "#8b5cf6", muted: "#71717a", green: "#10b981" };

type Filter = Relation | "all" | "ai_selected" | "opp" | "mon" | "no";
type ReviewFilter = "pending" | ReviewStatus | "all";

function matchesFilter(c: CandDTO, filter: Filter): boolean {
  switch (filter) {
    case "all": return true;
    case "ai_selected": return c.relation === "conflict" && (c.ai?.recommendation === "file_opposition" || c.ai?.recommendation === "monitor_closely");
    case "opp": return c.relation === "conflict" && c.ai?.recommendation === "file_opposition";
    case "mon": return c.relation === "conflict" && c.ai?.recommendation === "monitor_closely";
    case "no":  return c.relation === "conflict" && c.ai?.recommendation === "no_action";
    default:    return c.relation === filter; // conflict | firm | own
  }
}

const REL_LABEL: Record<Relation, string> = { conflict: "Conflicto", firm: "Presentada por tu firma", own: "Tu marca (aviso)" };
const REL_CLASS: Record<Relation, string> = {
  conflict: "bg-red-500/15 text-red-300",
  firm: "bg-violet-500/15 text-violet-300",
  own: "bg-blue-500/15 text-blue-300",
};
const AI_LABEL: Record<AiVerdict, string> = { file_opposition: "Oponerse", monitor_closely: "Vigilar", no_action: "Sin acción" };
const AI_CLASS: Record<AiVerdict, string> = {
  file_opposition: "bg-red-500/20 text-red-300",
  monitor_closely: "bg-amber-500/20 text-amber-300",
  no_action: "bg-[var(--bd)] text-[var(--mut)]",
};

function scoreColor(s: number): string {
  const t = Math.max(0, Math.min(1, (s - 55) / 45));
  return `hsl(${210 - 210 * t}, 78%, 58%)`;
}

function candKeyOf(pub: PubDTO, c: CandDTO): string {
  return `${pub.applicationNumber || pub.denom}::${c.clientCode}::${c.clientDenom}`;
}

function RelationCell({ c }: { c: CandDTO }) {
  if (c.relation === "conflict" && c.ai) {
    return (
      <div>
        <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${AI_CLASS[c.ai.recommendation]}`}>{AI_LABEL[c.ai.recommendation]}</span>
        <span className="ml-1 text-[11px] text-[var(--mut)]">{c.ai.prob}%</span>
        {c.ai.summary && (
          <details open className="mt-1">
            <summary className="cursor-pointer text-[11px] text-[var(--acc)]">análisis</summary>
            <p className="mt-1 max-w-xs text-[11px] text-[var(--mut)]">{c.ai.summary}</p>
          </details>
        )}
      </div>
    );
  }
  return <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${REL_CLASS[c.relation]}`}>{REL_LABEL[c.relation]}</span>;
}

function ReviewCell({ status, onSet }: { status?: ReviewStatus; onSet: (s: ReviewStatus | null) => void }) {
  const base = "inline-flex h-7 w-7 items-center justify-center rounded-md border transition";
  return (
    <div className="flex gap-1">
      <button title={status === "approved" ? "Devolver a pendientes" : "Aprobar"} onClick={() => onSet(status === "approved" ? null : "approved")}
        className={`${base} ${status === "approved" ? "border-emerald-500 bg-emerald-500/20 text-emerald-300" : "border-[var(--bd)] text-[var(--mut)] hover:text-[var(--tx)]"}`}>
        <Check size={15} />
      </button>
      <button title={status === "discarded" ? "Devolver a pendientes" : "Descartar"} onClick={() => onSet(status === "discarded" ? null : "discarded")}
        className={`${base} ${status === "discarded" ? "border-red-500 bg-red-500/20 text-red-300" : "border-[var(--bd)] text-[var(--mut)] hover:text-[var(--tx)]"}`}>
        <X size={15} />
      </button>
    </div>
  );
}

function Row({ c, pub, reviewable, status, reviewer, onReview }: {
  c: CandDTO; pub: PubDTO; reviewable: boolean; status?: ReviewStatus; reviewer?: string; onReview: (key: string, s: ReviewStatus | null) => void;
}) {
  const col = scoreColor(c.score);
  const dim = status === "discarded";
  return (
    <tr className={`border-b border-[var(--bd)] last:border-0 ${dim ? "opacity-45" : ""}`}>
      <td className="whitespace-nowrap px-4 py-2.5">
        <span className="mr-2 inline-block h-1.5 w-12 overflow-hidden rounded bg-[var(--bd)] align-middle">
          <span className="block h-full" style={{ width: `${c.score}%`, background: col }} />
        </span>
        <span className="font-mono text-sm font-semibold" style={{ color: col }}>{c.score}</span>
      </td>
      <td className="px-4 py-2.5">
        <div className={`font-semibold ${dim ? "line-through" : ""}`}>{c.clientDenom}</div>
        <div className="font-mono text-xs text-[var(--mut)]">{c.clientCode} · {c.clientStatus}</div>
        {c.clientHolder && <div className="text-xs text-blue-300">Titular: {c.clientHolder}</div>}
      </td>
      <td className="px-4 py-2.5 align-top"><ClassChips classes={c.clientClasses} pys={c.clientPys} match={c.matchingClasses} related={c.relatedClasses} /></td>
      <td className="px-4 py-2.5"><RelationCell c={c} /></td>
      {reviewable && (
        <td className="px-4 py-2.5">
          <ReviewCell status={status} onSet={(s) => onReview(candKeyOf(pub, c), s)} />
          {status && reviewer && <div className="mt-1 text-[10px] text-[var(--mut)]">por {reviewer}</div>}
        </td>
      )}
    </tr>
  );
}

function Pub({ g, filter, reviewable, reviews, reviewers, onReview, onDiscardGroup, imageUrl }: {
  g: PubDTO; filter: Filter; reviewable: boolean; reviews: Record<string, ReviewStatus>; reviewers: Record<string, string>; onReview: (key: string, s: ReviewStatus | null) => void; onDiscardGroup?: (keys: string[]) => void; imageUrl?: string;
}) {
  const rows = g.candidates.filter((c) => matchesFilter(c, filter));
  if (!rows.length) return null;
  const pendingKeys = rows
    .filter((c) => ((reviews[candKeyOf(g, c)] as ReviewStatus | undefined) ?? "pending") === "pending")
    .map((c) => candKeyOf(g, c));
  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-[var(--bd)] bg-[var(--bg2)]">
      <header className="flex items-start gap-3 border-b border-[var(--bd)] px-4 py-3">
        <span className="mt-0.5 shrink-0">
          {imageUrl
            ? <ZoomImage src={imageUrl} alt={g.denom || "Figurativa"} size={44} />
            : <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-dashed border-[var(--bd)] text-[10px] text-[var(--mut)]">s/img</span>}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{g.denom}</h2>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--mut)]">
            <span className="font-mono">{g.applicationNumber}</span>
            <span>{g.markType}</span>
            <span>Solicitante: {g.applicant || "—"}</span>
            {g.representant && <span>Apoderado: <span className="font-medium text-teal-300">{g.representant}</span></span>}
          </div>
          {g.classes.length > 0 && (
            <div className="mt-1 flex flex-wrap items-start gap-x-2 gap-y-1 text-xs text-[var(--mut)]">
              <span className="pt-0.5">Clases:</span>
              <ClassChips classes={g.classes} pys={g.pys} wide />
            </div>
          )}
        </div>
        {reviewable && onDiscardGroup && pendingKeys.length > 0 && (
          <button onClick={() => onDiscardGroup(pendingKeys)}
            title="Descartar todas las pendientes de esta publicación"
            className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-2.5 py-1 text-xs text-red-300 transition hover:bg-red-500/10">
            <X size={13} /> Descartar todas ({pendingKeys.length})
          </button>
        )}
      </header>
      {/* Desktop: tabla densa */}
      <table className="hidden w-full text-left sm:table">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-[var(--mut)]">
            <th className="px-4 py-2 font-medium">Score</th>
            <th className="px-4 py-2 font-medium">Marca del cliente</th>
            <th className="px-4 py-2 font-medium">Clases cliente</th>
            <th className="px-4 py-2 font-medium">Relación</th>
            {reviewable && <th className="px-4 py-2 font-medium">Revisión</th>}
          </tr>
        </thead>
        <tbody>{rows.map((c) => (
          <Row key={candKeyOf(g, c)} c={c} pub={g} reviewable={reviewable} status={reviews[candKeyOf(g, c)]} reviewer={reviewers[candKeyOf(g, c)]} onReview={onReview} />
        ))}</tbody>
      </table>

      {/* Móvil: tarjetas (swipe para aprobar/descartar) */}
      <div className="space-y-2 p-3 sm:hidden">
        {reviewable && <p className="text-[11px] text-[var(--mut)]">Desliza → aprobar · ← descartar</p>}
        {rows.map((c) => (
          <CandCard key={candKeyOf(g, c)} c={c} candKey={candKeyOf(g, c)} reviewable={reviewable}
            status={reviews[candKeyOf(g, c)]} reviewer={reviewers[candKeyOf(g, c)]} onReview={onReview} />
        ))}
      </div>
    </section>
  );
}

export default function Results({ dto, runId, reviews: initialReviews, reviewers: initialReviewers, canEdit = false, images = {}, currentUser }: {
  dto: ReportDTO; runId?: number; reviews?: Record<string, ReviewStatus>; reviewers?: Record<string, string>; canEdit?: boolean; images?: Record<string, string>; currentUser?: string;
}) {
  const [selectedFilter, setFilter] = useState<Filter | null>(null);
  const [ai, setAi] = useState<{ running: boolean; analyzed: number; total: number; error?: string } | null>(null);
  const [reviews, setReviews] = useState<Record<string, ReviewStatus>>(initialReviews ?? {});
  const [reviewers, setReviewers] = useState<Record<string, string>>(initialReviewers ?? {});
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("pending");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [savingCount, setSavingCount] = useState(0);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "pdf_full" | "xlsx" | "firm" | "own" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const savingReviews = useRef(new Set<string>());
  const router = useRouter();
  const { meta, stats, groups } = dto;
  const reviewable = !!runId && canEdit;

  const analyzedCount = groups.reduce((a, g) => a + g.candidates.filter((c) => c.relation === "conflict" && c.ai).length, 0);
  const analysisComplete = stats.conflict > 0 && analyzedCount >= stats.conflict;
  const showAiKpis = analyzedCount > 0;
  const filter = selectedFilter ?? (showAiKpis ? "ai_selected" : "conflict");
  const nApproved = Object.values(reviews).filter((s) => s === "approved").length;
  const nDiscarded = Object.values(reviews).filter((s) => s === "discarded").length;

  function applyStatus(key: string, status: ReviewStatus | null, who?: string) {
    setReviews((prev) => {
      const next = { ...prev };
      if (status === null) delete next[key]; else next[key] = status;
      return next;
    });
    setReviewers((prev) => {
      const next = { ...prev };
      if (status === null || !who) delete next[key]; else next[key] = who;
      return next;
    });
  }

  async function onReview(key: string, status: ReviewStatus | null) {
    if (!runId || savingReviews.current.has(key)) return;
    savingReviews.current.add(key);
    setSavingCount((n) => n + 1);
    const previous = reviews[key];
    const previousWho = reviewers[key];
    setReviewError(null);
    applyStatus(key, status, currentUser); // optimista: mi decisión, atribuida a mí
    try {
      const result = await setReviewAction(runId, key, status);
      if (!result.ok) throw new Error(result.error || "No se pudo guardar la revisión.");
    } catch {
      applyStatus(key, previous ?? null, previousWho); // rollback
      setReviewError("No se pudo guardar la revisión. Se restauró el estado anterior; vuelve a intentarlo.");
    } finally {
      savingReviews.current.delete(key);
      setSavingCount((n) => n - 1);
    }
  }

  // Sincronización en vivo entre revisores (Supabase Realtime, token firmado).
  useRealtimeReviews({
    runId,
    savingKeys: savingReviews,
    onRemoteChange: ({ candKey, status, reviewer }) => {
      if (savingReviews.current.has(candKey)) return; // no pisar mi guardado en curso
      applyStatus(candKey, status, reviewer ?? undefined);
    },
    onResync: async () => {
      if (!runId) return;
      const fresh = await getReviewsAction(runId);
      setReviews((prev) => {
        const next = { ...fresh.statuses };
        for (const k of savingReviews.current) { // conserva lo que tengo a medio guardar
          if (prev[k] !== undefined) next[k] = prev[k]; else delete next[k];
        }
        return next;
      });
      setReviewers((prev) => {
        const next = { ...fresh.reviewers };
        for (const k of savingReviews.current) {
          if (prev[k] !== undefined) next[k] = prev[k]; else delete next[k];
        }
        return next;
      });
    },
  });

  async function analyze() {
    if (!runId) return;
    setAi({ running: true, analyzed: analyzedCount, total: stats.conflict });
    try {
      for (let guard = 0; guard < 500; guard++) {
        const r = await analyzeBatchAction(runId, 15);
        if (!r.ok) { setAi({ running: false, analyzed: r.analyzed, total: r.total, error: r.error }); return; }
        setAi({ running: r.remaining > 0, analyzed: r.analyzed, total: r.total });
        if (r.remaining <= 0) {
          setFilter(null);
          break;
        }
      }
      router.refresh();
    } catch (e) {
      setAi({ running: false, analyzed: analyzedCount, total: stats.conflict, error: e instanceof Error ? e.message : "Error" });
    }
  }

  const matchingGroups = groups.map((g) => ({ ...g, candidates: g.candidates.filter((c) => matchesFilter(c, filter)) }));
  const reviewCounts = { pending: 0, approved: 0, discarded: 0, all: 0 };
  const pendingInView: string[] = []; // claves pendientes de la vista actual (para acción masiva)
  for (const g of matchingGroups) for (const c of g.candidates) {
    const st = (reviews[candKeyOf(g, c)] as ReviewStatus | undefined) ?? "pending";
    reviewCounts[st]++;
    reviewCounts.all++;
    if (st === "pending") pendingInView.push(candKeyOf(g, c));
  }

  async function discardKeys(rawKeys: string[], opts?: { confirm?: boolean }) {
    if (!runId || bulkBusy) return;
    const keys = rawKeys.filter((k) => !savingReviews.current.has(k));
    if (!keys.length) return;
    if (opts?.confirm && !confirm(`¿Descartar ${keys.length} ${keys.length === 1 ? "pendiente" : "pendientes"}? Podrás devolver alguna a pendiente después.`)) return;
    setBulkBusy(true);
    setReviewError(null);
    const prev = keys.map((k) => ({ k, s: reviews[k], w: reviewers[k] }));
    for (const k of keys) savingReviews.current.add(k);
    setSavingCount((n) => n + keys.length);
    setReviews((p) => { const n = { ...p }; for (const k of keys) n[k] = "discarded"; return n; });
    if (currentUser) setReviewers((p) => { const n = { ...p }; for (const k of keys) n[k] = currentUser; return n; });
    try {
      const r = await setReviewsBulkAction(runId, keys, "discarded");
      if (!r.ok) throw new Error(r.error || "Error");
    } catch {
      setReviews((p) => { const n = { ...p }; for (const { k, s } of prev) { if (s === undefined) delete n[k]; else n[k] = s; } return n; });
      setReviewers((p) => { const n = { ...p }; for (const { k, w } of prev) { if (w === undefined) delete n[k]; else n[k] = w; } return n; });
      setReviewError("No se pudieron descartar las pendientes. Se restauró el estado anterior; vuelve a intentarlo.");
    } finally {
      for (const k of keys) savingReviews.current.delete(k);
      setSavingCount((n) => n - keys.length);
      setBulkBusy(false);
    }
  }
  const visible = matchingGroups.map((g) => ({
    ...g,
    candidates: g.candidates.filter((c) => !reviewable || reviewFilter === "all" || (reviews[candKeyOf(g, c)] ?? "pending") === reviewFilter),
  })).filter((g) => g.candidates.length > 0);
  const nOpp = groups.reduce((a, g) => a + g.candidates.filter((c) => c.relation === "conflict" && c.ai?.recommendation === "file_opposition").length, 0);
  const nMon = groups.reduce((a, g) => a + g.candidates.filter((c) => c.relation === "conflict" && c.ai?.recommendation === "monitor_closely").length, 0);

  // Conjunto aprobado (independiente del filtro actual) → base del export
  const approvedGroups = groups
    .map((g) => ({ ...g, candidates: g.candidates.filter((c) => c.relation === "conflict" && reviews[candKeyOf(g, c)] === "approved") }))
    .filter((g) => g.candidates.length > 0);
  const approvedCount = approvedGroups.reduce((a, g) => a + g.candidates.length, 0);
  const section = filter === "firm" || filter === "own" ? filter : null;

  async function exportSection(format: "pdf" | "xlsx" = "pdf") {
    if (!section || !visible.length || savingReviews.current.size || exporting) return;
    setExporting(section);
    setExportError(null);
    try {
      const { createSectionPdf, createSectionExcel, downloadExport } = await import("@/lib/review-export");
      const blob = await (format === "xlsx" ? createSectionExcel : createSectionPdf)(visible, meta, section);
      const gazette = `${meta.country}${meta.number}`.replace(/[^a-zA-Z0-9_-]/g, "_");
      const base = section === "firm" ? "tu-firma-conflictos-internos" : "aviso-publicacion";
      downloadExport(blob, `vsion-${gazette}-${base}.${format}`);
    } catch {
      setExportError("No se pudo generar el archivo. Vuelve a intentarlo.");
    } finally {
      setExporting(null);
    }
  }

  async function exportApproved(format: "pdf" | "pdf_full" | "xlsx") {
    if (section || !approvedGroups.length || savingReviews.current.size || exporting) return;
    setExporting(format);
    setExportError(null);
    try {
      const { createApprovedExcel, createApprovedPdf, createFichasPdf, downloadExport } = await import("@/lib/review-export");
      const blob = await (format === "pdf_full"
        ? createFichasPdf(approvedGroups, meta, images)
        : (format === "pdf" ? createApprovedPdf : createApprovedExcel)(approvedGroups, meta));
      const gazette = `${meta.country}${meta.number}`.replace(/[^a-zA-Z0-9_-]/g, "_");
      const ext = format === "xlsx" ? "xlsx" : "pdf";
      const suffix = format === "pdf_full" ? "aprobadas-fichas" : "aprobadas";
      downloadExport(blob, `vsion-${gazette}-${suffix}.${ext}`);
    } catch {
      setExportError("No se pudo generar el archivo. Vuelve a intentarlo.");
    } finally {
      setExporting(null);
    }
  }

  const nNo = Math.max(0, analyzedCount - nOpp - nMon);
  const distro: Seg[] = showAiKpis
    ? [{ id: "opp", label: "Oponerse", value: nOpp, color: C.red }, { id: "mon", label: "Vigilar", value: nMon, color: C.amber }, { id: "no", label: "Sin acción", value: nNo, color: C.muted }, { id: "firm", label: "Tu firma", value: stats.firm, color: C.violet }, { id: "own", label: "Tu marca", value: stats.own, color: C.blue }]
    : [{ id: "conflict", label: "Conflicto", value: stats.conflict, color: C.red }, { id: "firm", label: "Tu firma", value: stats.firm, color: C.violet }, { id: "own", label: "Tu marca", value: stats.own, color: C.blue }];

  const distroIds = new Set(distro.map((s) => s.id));
  const activeId = distroIds.has(filter) ? filter : null;
  const onSelectSeg = (id: string) => setFilter(id === "__reset__" || id === filter ? null : (id as Filter));

  return (
    <div>
      {/* Widget de distribución + meta de gaceta */}
      <div className="mb-4">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-base font-semibold">Publicación {meta.country}{meta.number}</h2>
          <span className="text-xs text-[var(--mut)]">{meta.datePublic} · oposición hasta {meta.dateDue}</span>
          {reviewable && approvedCount > 0 && (
            <span className="ml-auto flex items-baseline gap-1.5"><span className="text-lg font-bold text-emerald-300">{approvedCount}</span><span className="text-xs text-[var(--mut)]">aprobadas</span></span>
          )}
        </div>
        <BarcodeStat segments={distro} activeId={activeId} onSelect={onSelectSeg} />
      </div>

      {/* Barra de IA (solo superadmin, mientras falte analizar) */}
      {runId && canEdit && stats.conflict > 0 && !analysisComplete && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--bd)] bg-[var(--bg2)] px-4 py-2.5">
          <BrainCircuit size={16} className="text-[var(--acc)]" />
          {ai?.running ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              <span className="text-sm">Analizando con IA… {ai.analyzed}/{ai.total}</span>
              <div className="ml-2 h-1.5 w-40 overflow-hidden rounded bg-[var(--bd)]">
                <div className="h-full bg-[var(--acc)]" style={{ width: `${ai.total ? (100 * ai.analyzed) / ai.total : 0}%` }} />
              </div>
            </>
          ) : (
            <>
              <span className="text-sm text-[var(--mut)]">
                {analyzedCount > 0 ? `IA parcial: ${analyzedCount}/${stats.conflict}` : `${stats.conflict} conflictos sin analizar`}
              </span>
              <button onClick={analyze} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[var(--acc)] px-3 py-1.5 text-sm font-medium text-black">
                <BrainCircuit size={15} /> {analyzedCount > 0 ? "Continuar IA" : "Analizar con IA"}
              </button>
            </>
          )}
          {ai?.error && <span className="w-full text-xs text-red-300">{ai.error}</span>}
        </div>
      )}

      {/* Toolbar: estado de revisión · Exportar (el filtro de vista es el widget de arriba) */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {reviewable && (
          <div className="inline-flex overflow-hidden rounded-lg border border-[var(--bd)] text-sm">
            {([["pending", "Pendientes"], ["approved", "Aprobadas"], ["discarded", "Descartadas"], ["all", "Todas"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setReviewFilter(id)} aria-pressed={reviewFilter === id}
                className={`border-l border-[var(--bd)] px-3 py-1.5 first:border-l-0 transition ${reviewFilter === id ? "bg-white/10 text-[var(--tx)]" : "text-[var(--mut)] hover:text-[var(--tx)]"}`}>
                {label} <span className="text-xs opacity-70">{reviewCounts[id]}</span>
              </button>
            ))}
          </div>
        )}

        {reviewable && pendingInView.length > 0 && (
          <button onClick={() => discardKeys(pendingInView, { confirm: true })} disabled={bulkBusy || savingCount > 0}
            title="Descarta de un golpe todas las pendientes de la vista actual"
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40">
            {bulkBusy ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />} Descartar pendientes ({pendingInView.length})
          </button>
        )}

        {section && (
          <div className="ml-auto flex flex-col items-end gap-1">
            <Menu label={section === "firm" ? "Exportar Tu firma" : "Exportar Aviso de publicación"}
              busy={exporting !== null} disabled={!visible.length || savingCount > 0 || exporting !== null}
              items={[
                { label: "PDF", onClick: () => exportSection("pdf") },
                { label: "Excel", onClick: () => exportSection("xlsx") },
              ]} />
            <span className="text-xs text-[var(--mut)]">{section === "firm" ? "Coincidencias internas de la vista actual" : "Solo marcas publicadas de la vista actual, sin duplicados"}</span>
          </div>
        )}
        {!section && reviewable && approvedCount > 0 && (
          <div className="ml-auto">
            <Menu label={`Exportar aprobadas (${approvedCount})`} busy={exporting !== null} disabled={savingCount > 0 || exporting !== null}
              items={[
                { label: "PDF simple", onClick: () => exportApproved("pdf") },
                { label: "PDF completo (fichas)", onClick: () => exportApproved("pdf_full") },
                { label: "Excel", onClick: () => exportApproved("xlsx") },
              ]} />
          </div>
        )}
      </div>
      {(reviewError || exportError) && <p role="alert" className="mb-4 text-sm text-red-300">{reviewError || exportError}</p>}

      {visible.length ? visible.map((g) => (
        <Pub key={g.applicationNumber || g.denom} g={g} filter={filter} reviewable={reviewable} reviews={reviews} reviewers={reviewers} onReview={onReview} onDiscardGroup={(keys) => discardKeys(keys)} imageUrl={images[g.image?.replace(/\.(webp|png|jpe?g)$/i, "")]} />
      )) : <p className="text-[var(--mut)]">Sin resultados para este filtro.</p>}
    </div>
  );
}

/** Menú desplegable simple (botón + panel), cierra al hacer clic fuera. */
function Menu({ label, disabled, busy, items }: {
  label: string; disabled?: boolean; busy?: boolean;
  items: { label: string; onClick: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 px-3 py-1.5 text-sm text-emerald-300 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} {label} <ChevronDown size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 min-w-44 rounded-lg border border-[var(--bd)] bg-[var(--bg2)] p-1 shadow-xl">
            {items.map((it) => (
              <button key={it.label} onClick={() => { setOpen(false); it.onClick(); }}
                className="block w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-white/5">
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
