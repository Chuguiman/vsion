"use client";

import { useState } from "react";
import { UploadCloud, Loader2, FileJson } from "lucide-react";
import { runComparison, type RunResult } from "./actions";
import Results from "./_components/Results";

function Drop({ label, hint, file, onFile }: {
  label: string; hint: string; file: File | null; onFile: (f: File | null) => void;
}) {
  return (
    <label className="flex-1 cursor-pointer rounded-xl border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-6 text-center hover:border-[var(--acc)]">
      <input type="file" accept=".json,application/json" className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      <FileJson className="mx-auto mb-2 text-[var(--mut)]" size={26} />
      <div className="font-medium">{label}</div>
      <div className="mt-1 text-xs text-[var(--mut)]">{file ? file.name : hint}</div>
    </label>
  );
}

export default function Home() {
  const [client, setClient] = useState<File | null>(null);
  const [gazette, setGazette] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<RunResult | null>(null);

  async function run() {
    if (!client || !gazette) return;
    setBusy(true); setRes(null);
    try {
      const [clientText, gazetteText] = await Promise.all([client.text(), gazette.text()]);
      setRes(await runComparison(clientText, gazetteText));
    } catch (e) {
      setRes({ ok: false, error: e instanceof Error ? e.message : "Error al procesar" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Nueva comparación</h1>
      <p className="mb-6 text-sm text-[var(--mut)]">
        Sube la cartera del cliente (casos.json) y una gaceta (CO####.json). El barrido fonético/textual corre en segundos.
      </p>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Drop label="Cartera del cliente" hint="casos.json" file={client} onFile={setClient} />
        <Drop label="Gaceta" hint="CO####.json" file={gazette} onFile={setGazette} />
      </div>

      <button onClick={run} disabled={!client || !gazette || busy}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--acc)] px-4 py-2 font-medium text-black disabled:opacity-40">
        {busy ? <Loader2 className="animate-spin" size={16} /> : <UploadCloud size={16} />}
        {busy ? "Procesando..." : "Comparar"}
      </button>

      {res && !res.ok && (
        <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{res.error}</p>
      )}

      {res?.ok && res.dto && (
        <div className="mt-8">
          <div className="mb-3 text-xs text-[var(--mut)]">
            Barrido en {res.elapsedMs} ms{res.runId ? ` · guardado en historial (#${res.runId})` : " · sin BD, no se guardó"}
          </div>
          <Results dto={res.dto} />
        </div>
      )}
    </div>
  );
}
