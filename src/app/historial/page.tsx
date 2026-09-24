import Link from "next/link";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import DeleteRunButton from "@/app/_components/DeleteRunButton";
import BarcodeStat, { type Seg } from "@/app/_components/BarcodeStat";

export const dynamic = "force-dynamic";

interface RunRow {
  id: number; country: string; gazette_number: string; date_public: string | Date | null;
  n_candidates: number; n_own: number; created_at: string | Date;
  organization_name: string | null;
  n_firm: number; n_conflict: number; n_analyzed: number; n_opposition: number; n_monitor: number;
  n_ai_selected: number; n_approved: number; n_discarded: number;
}

const pending = (r: RunRow) => Math.max(0, r.n_ai_selected - r.n_approved - r.n_discarded);
const fmtDate = (d: string | Date | null) => (d ? new Date(d).toLocaleDateString("es") : "—");
function distribution(r: RunRow): Seg[] {
  return [
    ...(r.n_analyzed > 0 ? [
      { id: "opp", label: "Oponerse", value: r.n_opposition, color: "#ef4444" },
      { id: "mon", label: "Vigilar", value: r.n_monitor, color: "#f59e0b" },
      { id: "no", label: "Sin acción", value: Math.max(0, r.n_analyzed - r.n_opposition - r.n_monitor), color: "#71717a" },
    ] : [{ id: "conflict", label: "Conflicto", value: r.n_conflict, color: "#ef4444" }]),
    { id: "firm", label: "Tu firma", value: r.n_firm, color: "#8b5cf6" },
    { id: "own", label: "Tu marca", value: r.n_own, color: "#3b82f6" },
  ];
}

export default async function Historial() {
  const db = getDb();
  if (!db) {
    return (
      <div>
        <h1 className="mb-4 text-xl font-semibold">Vigilancia</h1>
        <p className="rounded-lg border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 text-sm text-[var(--mut)]">
          Sin base de datos configurada. Define <code className="text-[var(--tx)]">DATABASE_URL</code> (Supabase) para guardar y ver el historial.
        </p>
      </div>
    );
  }

  // Aislamiento por organización: cada org ve solo sus corridas; el superadmin, todas.
  const s = await getSession();
  if (!s) return null;
  const isSuper = s.role === "superadmin";
  const orgFilter = isSuper ? db`` : db`WHERE r.organization_id = ${s.organizationId}`;
  const rows = await db<RunRow[]>`
    SELECT r.id, r.country, r.gazette_number, r.date_public, r.n_candidates, r.n_own, r.created_at,
      o.name AS organization_name,
      COALESCE((r.payload->'stats'->>'firm')::int, 0) AS n_firm,
      COALESCE((r.payload->'stats'->>'conflict')::int, 0) AS n_conflict,
      counts.n_analyzed, counts.n_opposition, counts.n_monitor,
      counts.n_ai_selected, counts.n_approved, counts.n_discarded
    FROM runs r LEFT JOIN organizations o ON o.id = r.organization_id
    CROSS JOIN LATERAL (
      SELECT
        count(*) FILTER (WHERE c->'ai' IS NOT NULL AND c->'ai' <> 'null'::jsonb)::int AS n_analyzed,
        count(*) FILTER (WHERE c->'ai'->>'recommendation' = 'file_opposition')::int AS n_opposition,
        count(*) FILTER (WHERE c->'ai'->>'recommendation' = 'monitor_closely')::int AS n_monitor,
        -- Revisión sobre las seleccionadas por IA (oponerse + vigilar), igual que la vista de la corrida
        count(*) FILTER (WHERE c->'ai'->>'recommendation' IN ('file_opposition', 'monitor_closely'))::int AS n_ai_selected,
        count(*) FILTER (WHERE c->'ai'->>'recommendation' IN ('file_opposition', 'monitor_closely') AND rv.status = 'approved')::int AS n_approved,
        count(*) FILTER (WHERE c->'ai'->>'recommendation' IN ('file_opposition', 'monitor_closely') AND rv.status = 'discarded')::int AS n_discarded
      FROM jsonb_array_elements(r.payload->'groups') g
      CROSS JOIN LATERAL jsonb_array_elements(g->'candidates') c
      LEFT JOIN reviews rv ON rv.run_id = r.id
        AND rv.cand_key = concat(COALESCE(NULLIF(g->>'applicationNumber', ''), g->>'denom'), '::', c->>'clientCode', '::', c->>'clientDenom')
      WHERE c->>'relation' = 'conflict'
    ) counts
    ${orgFilter}
    ORDER BY r.created_at DESC LIMIT 100`;

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Vigilancia</h1>
      <p className="mb-4 text-sm text-[var(--mut)]">Comparaciones ejecutadas y hits/matches encontrados en cada gaceta.</p>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--mut)]">Aún no hay corridas.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--bd)] bg-[var(--bg2)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-[var(--mut)]">
                <th rowSpan={2} className="px-4 py-2 font-medium">Publicación</th>
                {isSuper && <th rowSpan={2} className="px-4 py-2 font-medium">Organización</th>}
                <th rowSpan={2} className="px-4 py-2 font-medium">Publicada</th>
                <th colSpan={5} className="border-b border-[var(--bd)] px-2 pb-1 pt-2 text-center font-medium">Hits / matches</th>
                <th rowSpan={2} className="w-[40%] px-4 py-2 font-medium">Distribución</th>
                <th rowSpan={2} className="px-4 py-2 font-medium">Procesada</th>
                {isSuper && <th rowSpan={2} className="px-4 py-2 font-medium"></th>}
              </tr>
              <tr className="text-[10px] text-[var(--mut)]" title="Revisión de las seleccionadas por IA (oponerse + vigilar)">
                {["Hits", "Pendientes", "Aprobadas", "Descartadas", "Todas (IA)"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-2 pb-2 pt-1 text-center font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--bd)] last:border-0 hover:bg-white/5">
                  <td className="px-4 py-2.5">
                    <Link href={`/runs/${r.id}`} className="font-mono text-[var(--acc)] hover:underline">
                      {r.country}{r.gazette_number}
                    </Link>
                  </td>
                  {isSuper && <td className="px-4 py-2.5">{r.organization_name ?? "Sin organización"}</td>}
                  <td className="px-4 py-2.5 text-[var(--mut)]">{fmtDate(r.date_public)}</td>
                  <td className="px-2 py-2.5 text-center" title="Candidatos retenidos por el barrido de similitud">
                    <span className="inline-flex min-w-8 items-center justify-center rounded border border-[var(--acc)]/40 bg-[var(--acc)]/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-[var(--acc)]">
                      {r.n_candidates.toLocaleString()}
                    </span>
                  </td>
                  {r.n_analyzed > 0 ? (
                    <>
                      <td className={`px-2 py-2.5 text-center font-mono text-xs ${pending(r) > 0 ? "font-semibold text-amber-500" : "text-[var(--mut)]"}`}>{pending(r)}</td>
                      <td className="px-2 py-2.5 text-center font-mono text-xs">{r.n_approved}</td>
                      <td className="px-2 py-2.5 text-center font-mono text-xs">{r.n_discarded}</td>
                      <td className="px-2 py-2.5 text-center font-mono text-xs">{r.n_ai_selected}</td>
                    </>
                  ) : (
                    <td colSpan={4} className="px-2 py-2.5 text-center text-[11px] text-[var(--mut)]">Sin análisis IA</td>
                  )}
                  <td className="px-4 py-2.5"><BarcodeStat segments={distribution(r)} compact /></td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-[var(--mut)]">{fmtDate(r.created_at)}</td>
                  {isSuper && <td className="px-4 py-2.5 text-right"><DeleteRunButton runId={r.id} label={`${r.country}${r.gazette_number}`} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
