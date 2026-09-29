"use client";

import { useRef, useState } from "react";
import { Check, X } from "lucide-react";
import type { CandDTO, PubDTO, Relation, AiVerdict } from "@/lib/dto";
import type { ReviewStatus } from "@/lib/reviews";
import ClassChips from "./ClassChips";
import ZoomImage from "./ZoomImage";
import GenericBadge from "./GenericBadge";

const REL_LABEL: Record<Relation, string> = { conflict: "Conflicto", firm: "Tu firma", own: "Tu marca" };
const REL_CLASS: Record<Relation, string> = {
  conflict: "bg-red-500/15 text-red-300", firm: "bg-violet-500/15 text-violet-300", own: "bg-blue-500/15 text-blue-300",
};
const AI_LABEL: Record<AiVerdict, string> = { file_opposition: "Oponerse", monitor_closely: "Vigilar", no_action: "Sin acción" };
const AI_CLASS: Record<AiVerdict, string> = {
  file_opposition: "bg-red-500/20 text-red-300", monitor_closely: "bg-amber-500/20 text-amber-300", no_action: "bg-[var(--bd)] text-[var(--mut)]",
};
function scoreColor(s: number) { const t = Math.max(0, Math.min(1, (s - 55) / 45)); return `hsl(${210 - 210 * t}, 78%, 58%)`; }

const THRESHOLD = 72;

export default function CandCard({ c, candKey, status, reviewer, reviewable, onReview, clientImage, genericTerms }: {
  c: CandDTO; candKey: string; status?: ReviewStatus; reviewer?: string; reviewable: boolean;
  onReview: (key: string, s: ReviewStatus | null) => void; clientImage?: string; genericTerms?: string[] | null;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const col = scoreColor(c.score);
  const kind = c.relation === "conflict" && c.ai ? "ai" : "rel";

  function onStart(x: number) { if (!reviewable) return; startX.current = x; setDragging(true); }
  function onMove(x: number) { if (!dragging) return; setDx(Math.max(-130, Math.min(130, x - startX.current))); }
  function onEnd() {
    if (!dragging) return;
    setDragging(false);
    if (dx > THRESHOLD) onReview(candKey, status === "approved" ? null : "approved");
    else if (dx < -THRESHOLD) onReview(candKey, status === "discarded" ? null : "discarded");
    setDx(0);
  }

  const dim = status === "discarded";

  return (
    <div className={`relative overflow-hidden rounded-xl border ${status === "approved" ? "border-emerald-500/60" : status === "discarded" ? "border-red-500/60" : "border-[var(--bd)]"}`}>
      {/* fondos de acción revelados al deslizar */}
      {reviewable && (
        <>
          <div className="absolute inset-y-0 left-0 flex w-1/2 items-center bg-emerald-600/80 pl-4" style={{ opacity: dx > 8 ? 1 : 0 }}>
            <Check size={20} className="text-white" /> <span className="ml-2 text-sm font-medium text-white">Aprobar</span>
          </div>
          <div className="absolute inset-y-0 right-0 flex w-1/2 items-center justify-end bg-red-600/80 pr-4" style={{ opacity: dx < -8 ? 1 : 0 }}>
            <span className="mr-2 text-sm font-medium text-white">Descartar</span> <X size={20} className="text-white" />
          </div>
        </>
      )}

      {/* cara de la tarjeta */}
      <div
        className={`relative bg-[var(--bg2)] px-4 py-3 ${dim ? "opacity-50" : ""}`}
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? "none" : "transform .2s ease", touchAction: "pan-y" }}
        onTouchStart={(e) => onStart(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={onEnd}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            {clientImage && <ZoomImage src={clientImage} alt={c.clientDenom} size={40} />}
            <div className="min-w-0">
              <div className={`font-semibold ${dim ? "line-through" : ""}`}>{c.clientDenom}</div>
              <div className="font-mono text-xs text-[var(--mut)]">{c.clientCode} · {c.clientStatus}</div>
              {c.clientHolder && <div className="truncate text-xs text-blue-300">Titular: {c.clientHolder}</div>}
              {genericTerms && <GenericBadge terms={genericTerms} />}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="font-mono text-lg font-bold" style={{ color: col }}>{c.score}</span>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-start gap-2">
          {kind === "ai" && c.ai
            ? <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${AI_CLASS[c.ai.recommendation]}`}>{AI_LABEL[c.ai.recommendation]} · {c.ai.prob}%</span>
            : <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${REL_CLASS[c.relation]}`}>{REL_LABEL[c.relation]}</span>}
          {c.clientClasses.length > 0 && (
            <ClassChips classes={c.clientClasses} pys={c.clientPys} match={c.matchingClasses} related={c.relatedClasses} />
          )}
        </div>
        {c.ai?.summary && <p className="mt-2 text-xs text-[var(--mut)]">{c.ai.summary}</p>}

        {reviewable && status && (
          <div className="mt-2 flex items-center gap-2 text-[11px]">
            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold ${status === "approved" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
              {status === "approved" ? <Check size={12} /> : <X size={12} />} {status === "approved" ? "Aprobada" : "Descartada"}
            </span>
            <span className="text-[var(--mut)]">{reviewer ? `por ${reviewer} · ` : ""}desliza de nuevo para deshacer</span>
          </div>
        )}

        {/* Pistas de gesto en los bordes: verde = aprobar (→), rojo = descartar (←) */}
        {reviewable && (
          <>
            <span aria-hidden className={`pointer-events-none absolute inset-y-3 left-0 w-1 rounded-r ${status === "approved" ? "bg-emerald-400" : "bg-emerald-500/50"}`} />
            <span aria-hidden className={`pointer-events-none absolute inset-y-3 right-0 w-1 rounded-l ${status === "discarded" ? "bg-red-400" : "bg-red-500/50"}`} />
          </>
        )}
      </div>
    </div>
  );
}
