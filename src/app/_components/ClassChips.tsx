"use client";

import { useMemo, useState } from "react";
import { pysByClass } from "@/lib/pys";

/**
 * Badges de clases Niza clicables. Al hacer clic en una clase muestra su
 * descripción individual, extraída del texto de productos/servicios de esa
 * marca (pys). Opcionalmente resalta clases en común (match) y relacionadas.
 */
export default function ClassChips({ classes, pys, match = [], related = [], wide = false }: {
  classes: number[]; pys: string; match?: number[]; related?: number[]; wide?: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const desc = useMemo(() => pysByClass(pys, classes), [pys, classes]);
  if (!classes.length) return <span className="text-[var(--mut)]">—</span>;
  const matchSet = new Set(match), relSet = new Set(related);
  return (
    <div className={wide ? "w-full" : undefined}>
      <span className="inline-flex flex-wrap gap-1">
        {classes.map((n) => {
          const active = open === n;
          const tone = matchSet.has(n) ? "border-[var(--acc)] bg-emerald-500/15 text-[var(--acc)]"
            : relSet.has(n) ? "border-amber-500 bg-amber-500/10 text-amber-400"
            : "border-[var(--bd)] text-[var(--mut)]";
          return (
            <button key={n} type="button" onClick={() => setOpen(active ? null : n)}
              aria-pressed={active} title={desc[n] || `Clase ${n}`}
              className={`cursor-pointer rounded border px-1.5 font-mono text-[11px] transition hover:brightness-125 ${active ? "border-[var(--acc)] text-[var(--tx)] ring-1 ring-[var(--acc)]" : tone}`}>
              {n}
            </button>
          );
        })}
      </span>
      {open != null && (
        <div className={`mt-1.5 rounded-md border border-[var(--bd)] bg-[var(--bd)]/20 px-2 py-1.5 text-[11px] leading-snug text-[var(--mut)] ${wide ? "w-full" : "max-w-xs"}`}>
          <span className="font-semibold text-[var(--tx)]">Clase {open}</span>
          {desc[open] ? <> — {desc[open]}</> : " — sin descripción en el texto de esta marca."}
        </div>
      )}
    </div>
  );
}
