"use client";

export interface Seg {
  label: string;
  value: number;
  color: string;   // color CSS (hsl/hex/var)
}

/** Widget de distribución estilo "código de barras" con porcentajes por segmento. */
export default function BarcodeStat({ segments, total }: { segments: Seg[]; total?: number }) {
  const sum = total ?? segments.reduce((a, s) => a + s.value, 0);
  const pct = (v: number) => (sum > 0 ? (100 * v) / sum : 0);
  const visible = segments.filter((s) => s.value > 0);
  if (!visible.length) return null;

  return (
    <div className="rounded-2xl border border-[var(--bd)] bg-[var(--bg2)] p-4">
      {/* etiquetas + % alineadas a cada segmento */}
      <div className="flex items-end gap-2">
        {visible.map((s) => (
          <div key={s.label} style={{ flexGrow: Math.max(pct(s.value), 6) }} className="min-w-0">
            <div className="truncate text-[11px] uppercase tracking-wide text-[var(--mut)]">{s.label}</div>
            <div className="text-xl font-bold leading-none" style={{ color: s.color }}>
              {Math.round(pct(s.value))}<span className="text-sm">%</span>
            </div>
          </div>
        ))}
      </div>
      {/* barras */}
      <div className="mt-3 flex h-12 gap-1.5 overflow-hidden rounded-lg">
        {visible.map((s) => (
          <div key={s.label} style={{
            flexGrow: Math.max(pct(s.value), 6),
            backgroundColor: `color-mix(in srgb, ${s.color} 18%, transparent)`,
            backgroundImage: `repeating-linear-gradient(90deg, ${s.color} 0 2px, transparent 2px 5px)`,
          }} className="min-w-0 rounded-md" />
        ))}
      </div>
      {/* leyenda con conteos */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--mut)]">
        {visible.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.label}: <span className="font-semibold text-[var(--tx)]">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
