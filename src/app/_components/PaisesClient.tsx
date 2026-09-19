"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { setMonitoredAction } from "../paises-actions";
import type { CountryRow } from "@/lib/countries";

export default function PaisesClient({ countries }: { countries: CountryRow[] }) {
  const [rows, setRows] = useState(countries);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((c) => c.name.toLowerCase().includes(t) || c.iso2.toLowerCase().includes(t));
  }, [rows, q]);

  const activeCount = rows.filter((c) => c.is_active).length;

  async function toggle(c: CountryRow) {
    const next = !c.is_active;
    setRows((prev) => prev.map((r) => (r.id === c.id ? { ...r, is_active: next } : r)));
    const r = await setMonitoredAction(c.id, next);
    if (!r.ok) setRows((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_active: !next } : x))); // rollback
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mut)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar país…"
            className="w-64 rounded-lg border border-[var(--bd)] bg-[var(--bg2)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--acc)]" />
        </div>
        <span className="text-sm text-[var(--mut)]"><b className="text-[var(--acc)]">{activeCount}</b> monitoreados de {rows.length}</span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <button key={c.id} onClick={() => toggle(c)}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
              c.is_active ? "border-[var(--acc)] bg-emerald-500/10" : "border-[var(--bd)] bg-[var(--bg2)] hover:border-[var(--mut)]"
            }`}>
            <span className={`fi fi-${c.iso2.toLowerCase()} shrink-0 rounded-sm`} style={{ width: 24, height: 18 }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{c.name}</span>
              <span className="text-[11px] text-[var(--mut)]">{c.iso2} · {c.region || "—"}</span>
            </span>
            <span className={`h-4 w-7 shrink-0 rounded-full p-0.5 transition ${c.is_active ? "bg-[var(--acc)]" : "bg-[var(--bd)]"}`}>
              <span className={`block h-3 w-3 rounded-full bg-white transition ${c.is_active ? "translate-x-3" : ""}`} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
