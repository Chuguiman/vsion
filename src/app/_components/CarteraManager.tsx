"use client";

import { useState } from "react";
import { UploadCloud, Loader2, FileJson, Database } from "lucide-react";
import { importCarteraAction } from "../actions";

export default function CarteraManager({ info }: { info: { count: number; updatedAt: string | null } | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [count, setCount] = useState(info?.count ?? 0);

  async function importar() {
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const text = await file.text();
      const r = await importCarteraAction(text);
      if (r.ok) { setCount(r.count ?? 0); setMsg({ ok: true, text: `Cartera importada: ${r.count?.toLocaleString()} marcas.` }); }
      else setMsg({ ok: false, text: r.error ?? "Error" });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-xl font-semibold">Cartera del cliente</h1>
      <p className="mb-6 text-sm text-[var(--mut)]">
        Importa el casos.json una sola vez. Luego cada gaceta se compara contra esta cartera sin re-subirla.
      </p>

      <div className="mb-5 flex items-center gap-2 rounded-xl border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 text-sm">
        <Database size={16} className="text-[var(--acc)]" />
        <span className="font-medium">{count.toLocaleString()} marcas</span>
        <span className="text-[var(--mut)]">en cartera</span>
        {info?.updatedAt && <span className="ml-auto text-xs text-[var(--mut)]">importada {new Date(info.updatedAt).toLocaleString("es")}</span>}
      </div>

      <label className="mb-4 flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-6 text-center hover:border-[var(--acc)]">
        <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <FileJson className="mb-2 text-[var(--mut)]" size={26} />
        <div className="font-medium">{count > 0 ? "Reemplazar cartera" : "Importar cartera"}</div>
        <div className="mt-1 text-xs text-[var(--mut)]">{file ? file.name : "casos.json"}</div>
      </label>

      <button onClick={importar} disabled={!file || busy}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--acc)] px-4 py-2 font-medium text-black disabled:opacity-40">
        {busy ? <Loader2 className="animate-spin" size={16} /> : <UploadCloud size={16} />}
        {busy ? "Importando..." : count > 0 ? "Reemplazar" : "Importar"}
      </button>

      {msg && (
        <p className={`mt-4 rounded-lg border px-4 py-3 text-sm ${msg.ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-red-500/40 bg-red-500/10 text-red-300"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
