"use client";

import { useEffect, useRef } from "react";

/**
 * Animación SVG (JS con requestAnimationFrame): "ecualizador" de barras
 * verticales que oscilan en un arcoíris neón que rota lentamente + glow.
 */
export default function LoginArt() {
  const barsRef = useRef<(SVGRectElement | null)[]>([]);
  const dotsRef = useRef<(SVGCircleElement | null)[]>([]);
  const raf = useRef<number>(0);

  const N = 34;
  const VW = 400, VH = 600;
  const step = VW / N;
  const bw = step * 0.42;
  const DOT_COLORS = ["#a855f7", "#ff3b6b", "#3b82f6", "#ffe11a", "#39ff14"];

  useEffect(() => {
    const start = performance.now();
    const phase = Array.from({ length: N }, (_, i) => i * 0.6 + Math.sin(i) * 0.8);
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
        r.setAttribute("opacity", String(0.4 + s * 0.55));
        // arcoíris que rota
        const hue = ((i / N) * 360 + t * 0.02) % 360;
        r.setAttribute("fill", `hsl(${hue}, 92%, 60%)`);
      }
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
        <filter id="neon" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="glow" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.28" />
          <stop offset="55%" stopColor="#10b981" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={VW} height={VH} fill="#07070d" />
      <rect width={VW} height={VH} fill="url(#glow)" />
      <g filter="url(#neon)">
        {Array.from({ length: N }).map((_, i) => (
          <rect key={i} ref={(el) => { barsRef.current[i] = el; }}
            x={i * step + (step - bw) / 2} width={bw} height={120} y={VH / 2 - 60}
            rx={bw / 2} fill="#10b981" opacity={0.6} />
        ))}
      </g>
      {Array.from({ length: 5 }).map((_, i) => (
        <circle key={i} ref={(el) => { dotsRef.current[i] = el; }}
          cx={50 + i * 80} cy={100 + i * 110} r={i % 2 ? 3 : 2}
          fill={DOT_COLORS[i]} opacity={0.7} filter="url(#neon)" />
      ))}
    </svg>
  );
}
