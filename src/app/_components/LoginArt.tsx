"use client";

import { useEffect, useRef } from "react";

/**
 * Animación SVG (JS con requestAnimationFrame): un "ecualizador" de barras
 * verticales que oscilan — evoca el motif de código de barras/fonética de vsion.
 */
export default function LoginArt() {
  const barsRef = useRef<(SVGRectElement | null)[]>([]);
  const dotsRef = useRef<(SVGCircleElement | null)[]>([]);
  const raf = useRef<number>(0);

  const N = 34;      // barras
  const VW = 400, VH = 600;
  const step = VW / N;
  const bw = step * 0.42;

  useEffect(() => {
    const start = performance.now();
    // fase y velocidad por barra (aleatorio estable)
    const phase = Array.from({ length: N }, (_, i) => (i * 0.6) + Math.sin(i) * 0.8);
    const speed = Array.from({ length: N }, (_, i) => 0.0011 + (i % 5) * 0.00018);

    const tick = (now: number) => {
      const t = now - start;
      for (let i = 0; i < N; i++) {
        const r = barsRef.current[i];
        if (!r) continue;
        const s = (Math.sin(t * speed[i] + phase[i]) + 1) / 2; // 0..1
        const h = 40 + s * (VH * 0.62);
        r.setAttribute("height", String(h));
        r.setAttribute("y", String(VH / 2 - h / 2));
        r.setAttribute("opacity", String(0.25 + s * 0.6));
      }
      // puntos flotantes
      for (let i = 0; i < dotsRef.current.length; i++) {
        const d = dotsRef.current[i];
        if (!d) continue;
        const y = 80 + i * 120 + Math.sin(t * 0.0006 + i) * 40;
        d.setAttribute("cy", String(y % VH));
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="55%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={VW} height={VH} fill="#0a0f0d" />
      <rect width={VW} height={VH} fill="url(#glow)" />
      {Array.from({ length: N }).map((_, i) => (
        <rect key={i} ref={(el) => { barsRef.current[i] = el; }}
          x={i * step + (step - bw) / 2} width={bw} height={120} y={VH / 2 - 60}
          rx={bw / 2} fill="url(#barGrad)" opacity={0.5} />
      ))}
      {Array.from({ length: 4 }).map((_, i) => (
        <circle key={i} ref={(el) => { dotsRef.current[i] = el; }}
          cx={60 + i * 95} cy={100 + i * 120} r={i % 2 ? 3 : 2} fill="#6ee7b7" opacity={0.5} />
      ))}
    </svg>
  );
}
