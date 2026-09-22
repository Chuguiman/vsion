"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, X, SlidersHorizontal, ChevronDown, Loader2 } from "lucide-react";
import { setMonitoredAction, listCountriesAction } from "../paises-actions";
import ScopePanel from "./ScopePanel";
import type { CountryRow } from "@/lib/countries";

export default function PaisesClient({ countries, orgs = [], isSuper = false }: {
  countries: CountryRow[];
  orgs?: { id: number; name: string }[];
  isSuper?: boolean;
}) {
  const [rows, setRows] = useState(countries);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [orgId, setOrgId] = useState<string>(orgs.length === 1 ? String(orgs[0].id) : "");
  const [loading, setLoading] = useState(false);
  // org efectiva que se manda a las acciones (null para no-superadmin → su propia org)
  const orgArg = isSuper ? (orgId ? Number(orgId) : null) : null;

  useEffect(() => {
    if (!isSuper) return;
    setOpenId(null);
    if (!orgId) { setRows([]); return; }
    let alive = true;
    setLoading(true);
    listCountriesAction(Number(orgId))
      .then((r) => { if (alive) setRows(r.ok ? (r.countries ?? []) : []); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [orgId, isSuper]);

  const active = useMemo(() => rows.filter((c) => c.is_active).sort((a, b) => a.name.localeCompare(b.name)), [rows]);
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return rows.filter((c) => !c.is_active && (c.name.toLowerCase().includes(t) || c.iso2.toLowerCase().includes(t))).slice(0, 8);
  }, [rows, q]);

  async function setActive(c: CountryRow, next: boolean) {
    setRows((prev) => prev.map((r) => (r.id === c.id ? { ...r, is_active: next } : r)));
    const r = await setMonitoredAction(c.id, next, orgArg);
    if (!r.ok) setRows((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_active: !next } : x)));
    if (next) setQ("");
  }

  return (
    <div className="max-w-3xl">
      {isSuper && (
        <div className="mb-6 max-w-md">
          <label className="mb-1 block text-xs font-medium text-[var(--mut)]">Organización</label>
          <select value={orgId} onChange={(e) => setOrgId(e.target.value)}
            className="w-full rounded-lg border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 text-sm outline-none focus:border-[var(--acc)]">
            <option value="">Elige una organización…</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          {orgs.length === 0 && <p className="mt-1 text-xs text-amber-400">No hay organizaciones. Crea una en Usuarios.</p>}
        </div>
      )}

      {isSuper && !orgId ? (
        <p className="rounded-xl border border-dashed border-[var(--bd)] px-4 py-6 text-center text-sm text-[var(--mut)]">
          Elige una organización para gestionar sus países de monitoreo.
        </p>
      ) : loading ? (
        <div className="flex items-center gap-2 px-1 py-6 text-sm text-[var(--mut)]"><Loader2 size={15} className="animate-spin" /> Cargando países…</div>
      ) : (
      <>
      {/* Agregar país (búsqueda) */}
      <div className="mb-6">
        <label className="mb-1 block text-xs text-[var(--mut)]">Agregar país a monitorear</label>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mut)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar país por nombre o código (CO, MX…)"
            className="w-full rounded-lg border border-[var(--bd)] bg-[var(--bg2)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--acc)]" />
        </div>
        {matches.length > 0 && (
          <div className="mt-2 overflow-hidden rounded-lg border border-[var(--bd)] bg-[var(--bg2)]">
            {matches.map((c) => (
              <button key={c.id} onClick={() => setActive(c, true)}
                className="flex w-full items-center gap-3 border-b border-[var(--bd)] px-3 py-2 text-left last:border-0 hover:bg-white/5">
                <span className={`fi fi-${c.iso2.toLowerCase()} shrink-0 rounded-sm`} style={{ width: 22, height: 16 }} />
                <span className="flex-1 text-sm">{c.name}</span>
                <span className="text-[11px] text-[var(--mut)]">{c.iso2}</span>
                <Plus size={16} className="text-[var(--acc)]" />
              </button>
            ))}
          </div>
        )}
        {q.trim() && matches.length === 0 && <p className="mt-2 text-xs text-[var(--mut)]">Sin resultados nuevos (quizá ya está activo).</p>}
      </div>

      {/* Activos */}
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold">Monitoreados</h2>
        <span className="text-xs text-[var(--mut)]">{active.length}</span>
      </div>
      {active.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--bd)] px-4 py-6 text-center text-sm text-[var(--mut)]">
          Aún no monitoreas ningún país. Búscalo arriba y agrégalo.
        </p>
      ) : (
        <div className="space-y-2">
          {active.map((c) => {
            const open = openId === c.id;
            return (
              <div key={c.id} className="overflow-hidden rounded-xl border border-[var(--bd)] bg-[var(--bg2)]">
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <span className={`fi fi-${c.iso2.toLowerCase()} shrink-0 rounded-sm`} style={{ width: 24, height: 18 }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="text-[11px] text-[var(--mut)]">{c.iso2} · {c.region || "—"}</span>
                  </span>
                  <button onClick={() => setOpenId(open ? null : c.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition ${open ? "border-[var(--acc)] text-[var(--acc)]" : "border-[var(--bd)] text-[var(--mut)] hover:text-[var(--tx)]"}`}>
                    <SlidersHorizontal size={13} /> Vigilancia
                    <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                  <button onClick={() => setActive(c, false)} title="Quitar" className="text-[var(--mut)] hover:text-red-400"><X size={16} /></button>
                </div>
                {open && (
                  <div className="border-t border-[var(--bd)] bg-[var(--bg)]">
                    <ScopePanel country={c.iso2} name={c.name} orgId={orgArg} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </>
      )}
    </div>
  );
}
