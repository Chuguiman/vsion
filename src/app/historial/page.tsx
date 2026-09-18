import Link from "next/link";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RunRow {
  id: number; country: string; gazette_number: string; date_public: string | Date | null;
  n_candidates: number; n_own: number; created_at: string | Date;
}

const fmtDate = (d: string | Date | null) => (d ? new Date(d).toLocaleDateString("es") : "—");
const fmtDateTime = (d: string | Date) => new Date(d).toLocaleString("es");

export default async function Historial() {
  const db = getDb();
  if (!db) {
    return (
      <div>
        <h1 className="mb-4 text-xl font-semibold">Historial</h1>
        <p className="rounded-lg border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 text-sm text-[var(--mut)]">
          Sin base de datos configurada. Define <code className="text-[var(--tx)]">DATABASE_URL</code> (Supabase) para guardar y ver el historial.
        </p>
      </div>
    );
  }

  const rows = await db<RunRow[]>`
    SELECT id, country, gazette_number, date_public, n_candidates, n_own, created_at
    FROM runs ORDER BY created_at DESC LIMIT 100
  `;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Historial</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--mut)]">Aún no hay corridas.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--bd)] bg-[var(--bg2)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-[var(--mut)]">
                <th className="px-4 py-2 font-medium">Gaceta</th>
                <th className="px-4 py-2 font-medium">Publicada</th>
                <th className="px-4 py-2 font-medium">Conflictos</th>
                <th className="px-4 py-2 font-medium">Aviso</th>
                <th className="px-4 py-2 font-medium">Procesada</th>
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
                  <td className="px-4 py-2.5 text-[var(--mut)]">{fmtDate(r.date_public)}</td>
                  <td className="px-4 py-2.5">{r.n_candidates - r.n_own}</td>
                  <td className="px-4 py-2.5 text-blue-300">{r.n_own}</td>
                  <td className="px-4 py-2.5 text-[var(--mut)]">{fmtDateTime(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
