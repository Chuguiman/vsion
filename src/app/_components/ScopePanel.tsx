"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X, Search, Loader2, Check } from "lucide-react";
import {
  getScopeAction, setScopeAction, addWatchMarkAction, removeWatchMarkAction,
  searchMarksAction, listHoldersAction,
} from "../paises-actions";
import type { ScopeMode, MarkLite } from "@/lib/scopes";

const MODES: { id: ScopeMode; label: string; hint: string }[] = [
  { id: "all", label: "Cartera completa", hint: "Compara contra todas las marcas." },
  { id: "include", label: "Solo incluir", hint: "Solo las marcas seleccionadas abajo." },
  { id: "exclude", label: "Excluir", hint: "Todas menos las seleccionadas abajo." },
];

export default function ScopePanel({ country, name }: { country: string; name: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<ScopeMode>("all");
  const [holders, setHolders] = useState<string[]>([]);
  const [caseText, setCaseText] = useState("");
  const [marks, setMarks] = useState<MarkLite[]>([]);
  const [holderOpts, setHolderOpts] = useState<{ holder: string; n: number }[]>([]);
  const [holderInput, setHolderInput] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<MarkLite[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const [r, h] = await Promise.all([getScopeAction(country), listHoldersAction()]);
      if (r.ok && r.scope) {
        setMode(r.scope.mode);
        setHolders(r.scope.holders);
        setCaseText(r.scope.caseIds.join("\n"));
        setMarks(r.marks ?? []);
      }
      if (h.ok) setHolderOpts(h.holders ?? []);
      setLoading(false);
    })();
  }, [country]);

  function markSaved() { setSaved(true); setTimeout(() => setSaved(false), 1500); }

  async function save() {
    setSaving(true);
    const caseIds = caseText.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    const r = await setScopeAction(country, mode, holders, caseIds);
    setSaving(false);
    if (r.ok) markSaved();
  }

  function addHolder(h: string) {
    const v = h.trim();
    if (v && !holders.includes(v)) setHolders((p) => [...p, v]);
    setHolderInput("");
  }

  function onSearch(value: string) {
    setQ(value);
    clearTimeout(searchTimer.current);
    if (!value.trim()) { setResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const r = await searchMarksAction(value);
      setResults(r.marks ?? []);
      setSearching(false);
    }, 250);
  }

  async function addMark(m: MarkLite) {
    if (marks.some((x) => x.id === m.id)) return;
    setMarks((p) => [...p, m]);
    await addWatchMarkAction(country, m.id);
  }
  async function removeMark(id: number) {
    setMarks((p) => p.filter((x) => x.id !== id));
    await removeWatchMarkAction(country, id);
  }

  if (loading) return <div className="flex items-center gap-2 px-1 py-3 text-sm text-[var(--mut)]"><Loader2 size={14} className="animate-spin" /> Cargando perfil…</div>;

  return (
    <div className="space-y-4 px-1 py-2">
      {/* Modo */}
      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)} title={m.hint}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${mode === m.id ? "border-[var(--acc)] bg-[color-mix(in_srgb,var(--acc)_12%,transparent)] text-[var(--tx)]" : "border-[var(--bd)] text-[var(--mut)] hover:text-[var(--tx)]"}`}>
            {m.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-[var(--mut)]">{MODES.find((m) => m.id === mode)?.hint}</p>

      {mode !== "all" && (
        <>
          {/* Titulares */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--mut)]">Titulares / solicitantes</label>
            <div className="flex flex-wrap gap-1.5">
              {holders.map((h) => (
                <span key={h} className="inline-flex items-center gap-1 rounded-full border border-[var(--bd)] bg-[var(--bg)] px-2 py-0.5 text-xs">
                  {h}<button onClick={() => setHolders((p) => p.filter((x) => x !== h))} className="text-[var(--mut)] hover:text-red-400"><X size={12} /></button>
                </span>
              ))}
            </div>
            <div className="mt-1.5 flex gap-2">
              <input list={`holders-${country}`} value={holderInput}
                onChange={(e) => setHolderInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addHolder(holderInput); } }}
                placeholder="Escribe o elige un titular y Enter"
                className="flex-1 rounded-lg border border-[var(--bd)] bg-[var(--bg2)] px-3 py-1.5 text-sm outline-none focus:border-[var(--acc)]" />
              <datalist id={`holders-${country}`}>
                {holderOpts.map((h) => <option key={h.holder} value={h.holder}>{`${h.holder} (${h.n})`}</option>)}
              </datalist>
              <button onClick={() => addHolder(holderInput)} className="rounded-lg border border-[var(--bd)] px-2 text-[var(--mut)] hover:text-[var(--tx)]"><Plus size={16} /></button>
            </div>
          </div>

          {/* Expedientes */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--mut)]">Expedientes / solicitudes (uno por línea o separados por coma)</label>
            <textarea value={caseText} onChange={(e) => setCaseText(e.target.value)} rows={3}
              placeholder="Ej. 1234567&#10;SD2024/098765"
              className="w-full rounded-lg border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 text-sm font-mono outline-none focus:border-[var(--acc)]" />
          </div>

          {/* Selección manual */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--mut)]">Marcas seleccionadas a mano <span className="text-[var(--tx)]">({marks.length})</span></label>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mut)]" />
              <input value={q} onChange={(e) => onSearch(e.target.value)} placeholder="Buscar en la cartera por marca, código o expediente"
                className="w-full rounded-lg border border-[var(--bd)] bg-[var(--bg2)] py-1.5 pl-9 pr-3 text-sm outline-none focus:border-[var(--acc)]" />
            </div>
            {(searching || results.length > 0) && q.trim() && (
              <div className="mt-1.5 max-h-52 overflow-auto rounded-lg border border-[var(--bd)] bg-[var(--bg2)]">
                {searching && <div className="px-3 py-2 text-xs text-[var(--mut)]">Buscando…</div>}
                {results.map((m) => {
                  const added = marks.some((x) => x.id === m.id);
                  return (
                    <button key={m.id} onClick={() => addMark(m)} disabled={added}
                      className="flex w-full items-center gap-2 border-b border-[var(--bd)] px-3 py-1.5 text-left last:border-0 hover:bg-white/5 disabled:opacity-40">
                      <span className="min-w-0 flex-1 truncate text-sm">{m.denom}</span>
                      <span className="shrink-0 font-mono text-[11px] text-[var(--mut)]">{m.code || m.holder || ""}</span>
                      {added ? <Check size={14} className="text-[var(--acc)]" /> : <Plus size={14} className="text-[var(--mut)]" />}
                    </button>
                  );
                })}
              </div>
            )}
            {marks.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {marks.map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-1 rounded-full border border-[var(--acc)] bg-[color-mix(in_srgb,var(--acc)_10%,transparent)] px-2 py-0.5 text-xs">
                    {m.denom}<button onClick={() => removeMark(m.id)} className="text-[var(--mut)] hover:text-red-400"><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--acc)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : null}
          {saved ? "Guardado" : "Guardar perfil"}
        </button>
        <span className="text-xs text-[var(--mut)]">Perfil para gacetas de {name} ({country})</span>
      </div>
    </div>
  );
}
