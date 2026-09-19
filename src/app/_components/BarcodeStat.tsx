"use client";

export interface Seg {
  id: string;
  label: string;
  value: number;
  color: string;   // color CSS (hsl/hex/var)
}

/**
 * Widget de distribución estilo "código de barras" con porcentajes por segmento.
 * Si se pasa onSelect, cada segmento es clicable y actúa como filtro.
 */
export default function BarcodeStat({ segments, total, activeId, onSelect }: {
  segments: Seg[]; total?: number; activeId?: string | null; onSelect?: (id: string) => void;
}) {
  const sum = total ?? segments.reduce((a, s) => a + s.value, 0);
  const pct = (v: number) => (sum > 0 ? (100 * v) / sum : 0);
  const visible = segments.filter((s) => s.value > 0);
  if (!visible.length) return null;
  const interactive = !!onSelect;
  const someActive = interactive && visible.some((s) => s.id === activeId);

  return (
    <div className="rounded-2xl border border-[var(--bd)] bg-[var(--bg2)] p-4">
      {/* etiquetas + % (clicables si hay filtro) */}
      <div className="flex items-end gap-2">
        {visible.map((s) => {
          const active = s.id === activeId;
          const faded = someActive && !active;
          const inner = (
            <>
              <div className="truncate text-[11px] uppercase tracking-wide text-[var(--mut)]">{s.label}</div>
              <div className="text-xl font-bold leading-none" style={{ color: s.color }}>
                {Math.round(pct(s.value))}<span className="text-sm">%</span>
              </div>
            </>
          );
          return interactive ? (
            <button key={s.id} onClick={() => onSelect!(s.id)}
              style={{ flexGrow: Math.max(pct(s.value), 6) }}
              className={`min-w-0 rounded-lg px-1 py-0.5 text-left transition ${active ? "bg-white/5 ring-1 ring-[var(--acc)]" : "hover:bg-white/5"} ${faded ? "opacity-45" : ""}`}>
              {inner}
            </button>
          ) : (
            <div key={s.id} style={{ flexGrow: Math.max(pct(s.value), 6) }} className="min-w-0">{inner}</div>
          );
        })}
      </div>
      {/* barras */}
      <div className="mt-3 flex h-12 gap-1.5 overflow-hidden rounded-lg">
        {visible.map((s) => {
          const faded = someActive && s.id !== activeId;
          return (
            <div key={s.id} onClick={interactive ? () => onSelect!(s.id) : undefined}
              style={{
                flexGrow: Math.max(pct(s.value), 6),
                backgroundColor: `color-mix(in srgb, ${s.color} 18%, transparent)`,
                backgroundImage: `repeating-linear-gradient(90deg, ${s.color} 0 2px, transparent 2px 5px)`,
                opacity: faded ? 0.4 : 1,
              }}
              className={`min-w-0 rounded-md transition ${interactive ? "cursor-pointer" : ""}`} />
          );
        })}
      </div>
      {/* leyenda con conteos */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--mut)]">
        {visible.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.label}: <span className="font-semibold text-[var(--tx)]">{s.value}</span>
          </span>
        ))}
      </div>
      {interactive && someActive && (
        <button onClick={() => onSelect!("__reset__")} className="mt-2 text-xs text-[var(--acc)] hover:underline">
          Ver todo
        </button>
      )}
    </div>
  );
}
