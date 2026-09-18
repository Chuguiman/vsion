"use client";

import { useState } from "react";
import type { ReportDTO, PubDTO, CandDTO, Relation } from "@/lib/dto";

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

function ClassBadges({ match, related }: { match: number[]; related: number[] }) {
  if (!match.length && !related.length) return <span className="text-[var(--mut)]">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {match.map((n) => (
        <span key={"m" + n} className="rounded border border-[var(--acc)] bg-emerald-500/15 px-1.5 font-mono text-[11px] text-[var(--acc)]">{n}</span>
      ))}
      {related.map((n) => (
        <span key={"r" + n} className="rounded border border-amber-500 bg-amber-500/10 px-1.5 font-mono text-[11px] text-amber-400">{n}</span>
      ))}
    </span>
  );
}

function Row({ c }: { c: CandDTO }) {
  return (
    <tr className="border-b border-[var(--bd)] last:border-0">
      <td className="whitespace-nowrap px-4 py-2.5">
        <span className="mr-2 inline-block h-1.5 w-12 overflow-hidden rounded bg-[var(--bd)] align-middle">
          <span className="block h-full bg-[var(--acc)]" style={{ width: `${c.score}%` }} />
        </span>
        <span className="font-mono text-sm">{c.score}</span>
      </td>
      <td className="px-4 py-2.5">
        <div className="font-semibold">{c.clientDenom}</div>
        <div className="font-mono text-xs text-[var(--mut)]">{c.clientCode} · {c.clientStatus}</div>
        {c.clientHolder && <div className="text-xs text-blue-300">Titular: {c.clientHolder}</div>}
      </td>
      <td className="px-4 py-2.5"><ClassBadges match={c.matchingClasses} related={c.relatedClasses} /></td>
      <td className="px-4 py-2.5">
        <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${REL_CLASS[c.relation]}`}>
          {REL_LABEL[c.relation]}
        </span>
      </td>
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
          {g.representant && <span>Apoderado gaceta: {g.representant}</span>}
        </div>
      </header>
      <table className="w-full text-left">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-[var(--mut)]">
            <th className="px-4 py-2 font-medium">Score</th>
            <th className="px-4 py-2 font-medium">Marca del cliente</th>
            <th className="px-4 py-2 font-medium">Clases</th>
            <th className="px-4 py-2 font-medium">Relación</th>
          </tr>
        </thead>
        <tbody>{rows.map((c, i) => <Row key={i} c={c} />)}</tbody>
      </table>
    </section>
  );
}

export default function Results({ dto }: { dto: ReportDTO }) {
  const [filter, setFilter] = useState<Filter>("conflict");
  const { meta, stats, groups } = dto;

  const Btn = ({ id, label }: { id: Filter; label: string }) => (
    <button
      onClick={() => setFilter(id)}
      className={`rounded-lg border px-3 py-1.5 text-sm ${
        filter === id ? "border-[var(--acc)] text-[var(--acc)]" : "border-[var(--bd)] text-[var(--tx)]"
      } bg-[var(--bg2)]`}
    >
      {label}
    </button>
  );

  const visible = groups.filter((g) => filter === "all" || g.candidates.some((c) => c.relation === filter));

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <Kpi n={stats.conflict} label="Conflictos" accent="red" />
        <Kpi n={stats.firm} label="Presentadas por tu firma" accent="violet" />
        <Kpi n={stats.own} label="Tu marca (aviso)" accent="blue" />
        <Kpi n={stats.clientCount} label="Marcas cliente" />
      </div>

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

function Kpi({ n, label, accent }: { n: number; label: string; accent?: "red" | "violet" | "blue" }) {
  const color = accent === "red" ? "text-red-300" : accent === "violet" ? "text-violet-300" : accent === "blue" ? "text-blue-300" : "";
  return (
    <div className="min-w-24 rounded-xl border border-[var(--bd)] bg-[var(--bg2)] px-4 py-2.5">
      <div className={`text-2xl font-bold ${color}`}>{n}</div>
      <div className="text-[11px] uppercase tracking-wide text-[var(--mut)]">{label}</div>
    </div>
  );
}
