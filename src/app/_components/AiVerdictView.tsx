"use client";

import type { AiResult, AiVerdict } from "@/lib/dto";

export const AI_LABEL: Record<AiVerdict, string> = { file_opposition: "Oponerse", monitor_closely: "Vigilar", no_action: "Sin acción" };
export const AI_CLASS: Record<AiVerdict, string> = {
  file_opposition: "bg-red-500/20 text-red-300",
  monitor_closely: "bg-amber-500/20 text-amber-300",
  no_action: "bg-[var(--bd)] text-[var(--mut)]",
};
const LEVEL_LABEL = { alta: "riesgo alto", media: "riesgo medio", baja: "riesgo bajo" } as const;
const FACTORS = [["phonetic", "Fonético"], ["visual", "Visual"], ["conceptual", "Concepto"], ["goods", "Productos"]] as const;
const SCALE = ["nulo", "bajo", "notable", "idéntico"];
const GOODS_SCALE = ["sin relación", "remota", "relacionados", "mismos"];

/** Etiqueta compacta: veredicto + nivel (v2) o % (v1). */
export function AiBadge({ ai }: { ai: AiResult }) {
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${AI_CLASS[ai.recommendation]}`}>
      {AI_LABEL[ai.recommendation]}
      <span className="font-normal opacity-80"> · {ai.level ? LEVEL_LABEL[ai.level] : `${ai.prob}%`}</span>
    </span>
  );
}

function Dots({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5 align-middle" aria-hidden>
      {[1, 2, 3].map((i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= n ? "bg-[var(--acc)]" : "bg-[var(--bd)]"}`} />)}
    </span>
  );
}

/** Detalle del análisis: por qué está aquí, factores, resumen y argumentos. */
export function AiDetail({ ai, compact }: { ai: AiResult; compact?: boolean }) {
  const f = ai.factors;
  return (
    <div className={`space-y-1.5 text-[11px] leading-4 text-[var(--mut)] ${compact ? "max-w-xs" : ""}`}>
      {ai.why && <p><span className="font-semibold text-[var(--tx)]">Por qué está aquí:</span> {ai.why}</p>}
      {f && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {FACTORS.map(([k, label]) => (
            <span key={k} title={`${label}: ${(k === "goods" ? GOODS_SCALE : SCALE)[f[k]]}`} className="inline-flex items-center gap-1">
              {label} <Dots n={f[k]} />
            </span>
          ))}
          {ai.weakMatch
            ? <span className="rounded bg-sky-500/15 px-1 text-sky-300" title="No es conflicto legal, pero comparten un elemento débil en los mismos productos/servicios">coincidencia débil · mismos productos</span>
            : ai.shared === "weak" && <span className="rounded bg-zinc-500/15 px-1">comparten solo elemento débil</span>}
        </div>
      )}
      {ai.summary && <p>{ai.summary}</p>}
      {(ai.keyRisk || ai.keyDefense || ai.reasoning) && (
        <details>
          <summary className="cursor-pointer text-[var(--acc)]">argumentos</summary>
          <div className="mt-1 space-y-1">
            {ai.keyRisk && <p><span className="font-semibold text-red-300">A favor de oponerse:</span> {ai.keyRisk}</p>}
            {ai.keyDefense && <p><span className="font-semibold text-emerald-300">Defensa del solicitante:</span> {ai.keyDefense}</p>}
            {ai.reasoning && <p><span className="font-semibold text-[var(--tx)]">Razonamiento:</span> {ai.reasoning}</p>}
            {ai.adjustments && <p className="italic">Ajustado por reglas: {ai.adjustments.join("; ")}.</p>}
            {ai.confidence && <p>Confianza de la IA: {ai.confidence}.</p>}
          </div>
        </details>
      )}
    </div>
  );
}
