"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, Loader2 } from "lucide-react";
import type { ReportDTO, PubDTO, CandDTO, Relation, AiVerdict } from "@/lib/dto";
import { analyzeBatchAction } from "../actions";

type Filter = Relation | "all";

const REL_LABEL: Record<Relation, string> = {
  conflict: "Conflicto",
  firm: "Presentada por tu firma",
  own: "Tu marca (aviso)",
};
const REL_CLASS: Record<Relation, string> = {
  conflict: "bg-red-500/15 text-red-300",
  firm: "bg-violet-500/15 text-violet-300",
  own: "bg-blue-500/15 text-blue-300",
};
const AI_LABEL: Record<AiVerdict, string> = {
  file_opposition: "Oponerse",
  monitor_closely: "Vigilar",
  no_action: "Sin acción",
};
const AI_CLASS: Record<AiVerdict, string> = {
  file_opposition: "bg-red-500/20 text-red-300",
  monitor_closely: "bg-amber-500/20 text-amber-300",
  no_action: "bg-[var(--bd)] text-[var(--mut)]",
};

function scoreColor(s: number): string {
  const t = Math.max(0, Math.min(1, (s - 55) / 45));
  return `hsl(${210 - 210 * t}, 78%, 58%)`;
}

function ClassBadges({ clientClasses, match, related }: { clientClasses: number[]; match: number[]; related: number[] }) {
  if (!clientClasses.length) return <span className="text-[var(--mut)]">—</span>;
  const matchSet = new Set(match), relSet = new Set(related);
  return (
    <span className="inline-flex flex-wrap gap-1">
      {clientClasses.map((n) => {
        const cls = matchSet.has(n) ? "border-[var(--acc)] bg-emerald-500/15 text-[var(--acc)]"
          : relSet.has(n) ? "border-amber-500 bg-amber-500/10 text-amber-400"
          : "border-[var(--bd)] text-[var(--mut)]";
        return <span key={n} className={`rounded border px-1.5 font-mono text-[11px] ${cls}`}>{n}</span>;
      })}
    </span>
  );
}

function RelationCell({ c }: { c: CandDTO }) {
  if (c.relation === "conflict" && c.ai) {
    return (
      <div>
        <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${AI_CLASS[c.ai.recommendation]}`}>{AI_LABEL[c.ai.recommendation]}</span>
        <span className="ml-1 text-[11px] text-[var(--mut)]">{c.ai.prob}%</span>
        {c.ai.summary && (
          <details className="mt-1">
            <summary className="cursor-pointer text-[11px] text-[var(--acc)]">análisis</summary>
            <p className="mt-1 max-w-xs text-[11px] text-[var(--mut)]">{c.ai.summary}</p>
          </details>
        )}
      </div>
    );
  }
  return <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${REL_CLASS[c.relation]}`}>{REL_LABEL[c.relation]}</span>;
}

function Row({ c }: { c: CandDTO }) {
  const col = scoreColor(c.score);
  return (
    <tr className="border-b border-[var(--bd)] last:border-0">
      <td className="whitespace-nowrap px-4 py-2.5">
        <span className="mr-2 inline-block h-1.5 w-12 overflow-hidden rounded bg-[var(--bd)] align-middle">
          <span className="block h-full" style={{ width: `${c.score}%`, background: col }} />
        </span>
        <span className="font-mono text-sm font-semibold" style={{ color: col }}>{c.score}</span>
      </td>
      <td className="px-4 py-2.5">
        <div className="font-semibold">{c.clientDenom}</div>
        <div className="font-mono text-xs text-[var(--mut)]">{c.clientCode} · {c.clientStatus}</div>
        {c.clientHolder && <div className="text-xs text-blue-300">Titular: {c.clientHolder}</div>}
      </td>
      <td className="px-4 py-2.5"><ClassBadges clientClasses={c.clientClasses} match={c.matchingClasses} related={c.relatedClasses} /></td>
      <td className="px-4 py-2.5"><RelationCell c={c} /></td>
    </tr>
  );
}

function Pub({ g, filter }: { g: PubDTO; filter: Filter }) {
  const rows = g.candidates.filter((c) => filter === "all" || c.relation === filter);
  if (!rows.length) return null;
  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-[var(--bd)] bg-[var(--bg2)]">
      <header className="border-b border-[var(--bd)] px-4 py-3">
        <h2 className="text-base font-semibold">{g.denom}</h2>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--mut)]">
          <span className="font-mono">{g.applicationNumber}</span>
          <span>{g.markType}</span>
          <span>Clases: {g.classes.join(", ") || "—"}</span>
          <span>Solicitante: {g.applicant || "—"}</span>
          {g.representant && <span>Apoderado gaceta: <span className="font-medium text-teal-300">{g.representant}</span></span>}
        </div>
      </header>
      <table className="w-full text-left">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-[var(--mut)]">
            <th className="px-4 py-2 font-medium">Score</th>
            <th className="px-4 py-2 font-medium">Marca del cliente</th>
            <th className="px-4 py-2 font-medium">Clases cliente</th>
            <th className="px-4 py-2 font-medium">Relación</th>
          </tr>
        </thead>
        <tbody>{rows.map((c, i) => <Row key={i} c={c} />)}</tbody>
      </table>
    </section>
  );
}

export default function Results({ dto, runId }: { dto: ReportDTO; runId?: number }) {
  const [filter, setFilter] = useState<Filter>("conflict");
  const [ai, setAi] = useState<{ running: boolean; analyzed: number; total: number; error?: string } | null>(null);
  const router = useRouter();
  const { meta, stats, groups } = dto;

  // Cuántos conflictos ya tienen veredicto IA
  const analyzedCount = groups.reduce((a, g) => a + g.candidates.filter((c) => c.relation === "conflict" && c.ai).length, 0);

  async function analyze() {
    if (!runId) return;
    setAi({ running: true, analyzed: analyzedCount, total: stats.conflict });
    try {
      for (let guard = 0; guard < 500; guard++) {
        const r = await analyzeBatchAction(runId, 15);
        if (!r.ok) { setAi({ running: false, analyzed: r.analyzed, total: r.total, error: r.error }); return; }
        setAi({ running: r.remaining > 0, analyzed: r.analyzed, total: r.total });
        if (r.remaining <= 0) break;
      }
      router.refresh(); // recargar el payload con los veredictos
    } catch (e) {
      setAi({ running: false, analyzed: analyzedCount, total: stats.conflict, error: e instanceof Error ? e.message : "Error" });
    }
  }

  const Btn = ({ id, label }: { id: Filter; label: string }) => (
    <button onClick={() => setFilter(id)}
      className={`rounded-lg border px-3 py-1.5 text-sm ${filter === id ? "border-[var(--acc)] text-[var(--acc)]" : "border-[var(--bd)] text-[var(--tx)]"} bg-[var(--bg2)]`}>
      {label}
    </button>
  );

  const visible = groups.filter((g) => filter === "all" || g.candidates.some((c) => c.relation === filter));
  const nOpp = groups.reduce((a, g) => a + g.candidates.filter((c) => c.ai?.recommendation === "file_opposition").length, 0);
  const nMon = groups.reduce((a, g) => a + g.candidates.filter((c) => c.ai?.recommendation === "monitor_closely").length, 0);
  const showAiKpis = analyzedCount > 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        {showAiKpis ? (
          <>
            <Kpi n={nOpp} label="Oponerse" accent="red" />
            <Kpi n={nMon} label="Vigilar" accent="amber" />
          </>
        ) : (
          <Kpi n={stats.conflict} label="Conflictos" accent="red" />
        )}
        <Kpi n={stats.firm} label="Presentadas por tu firma" accent="violet" />
        <Kpi n={stats.own} label="Tu marca (aviso)" accent="blue" />
        <Kpi n={stats.clientCount} label="Marcas cliente" />
      </div>

      {runId && stats.conflict > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3">
          <BrainCircuit size={18} className="text-[var(--acc)]" />
          {ai?.running ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Analizando conflictos con IA… {ai.analyzed}/{ai.total}</span>
              <div className="ml-2 h-1.5 w-40 overflow-hidden rounded bg-[var(--bd)]">
                <div className="h-full bg-[var(--acc)]" style={{ width: `${ai.total ? (100 * ai.analyzed) / ai.total : 0}%` }} />
              </div>
            </>
          ) : (
            <>
              <span className="text-sm">
                {analyzedCount >= stats.conflict && stats.conflict > 0
                  ? `IA completada: ${stats.conflict} conflictos analizados.`
                  : analyzedCount > 0
                  ? `IA parcial: ${analyzedCount}/${stats.conflict}. Continuar análisis.`
                  : `${stats.conflict} conflictos sin analizar. La IA los revisa como un abogado y prioriza.`}
              </span>
              <button onClick={analyze}
                className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[var(--acc)] px-3 py-1.5 text-sm font-medium text-black">
                <BrainCircuit size={15} /> {analyzedCount > 0 && analyzedCount < stats.conflict ? "Continuar IA" : "Analizar con IA"}
              </button>
            </>
          )}
          {ai?.error && <span className="w-full text-xs text-red-300">{ai.error}</span>}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Btn id="conflict" label={`Conflictos (${stats.conflict})`} />
        <Btn id="firm" label={`Tu firma (${stats.firm})`} />
        <Btn id="own" label={`Tu marca (${stats.own})`} />
        <Btn id="all" label="Todas" />
        <span className="ml-auto text-xs text-[var(--mut)]">
          Gaceta {meta.country}{meta.number} · {meta.datePublic} · oposición hasta {meta.dateDue}
        </span>
      </div>

      {visible.length ? visible.map((g, i) => <Pub key={i} g={g} filter={filter} />)
        : <p className="text-[var(--mut)]">Sin resultados para este filtro.</p>}
    </div>
  );
}

function Kpi({ n, label, accent }: { n: number; label: string; accent?: "red" | "violet" | "blue" | "amber" }) {
  const color = accent === "red" ? "text-red-300" : accent === "amber" ? "text-amber-300" : accent === "violet" ? "text-violet-300" : accent === "blue" ? "text-blue-300" : "";
  return (
    <div className="min-w-24 rounded-xl border border-[var(--bd)] bg-[var(--bg2)] px-4 py-2.5">
      <div className={`text-2xl font-bold ${color}`}>{n}</div>
      <div className="text-[11px] uppercase tracking-wide text-[var(--mut)]">{label}</div>
    </div>
  );
}
