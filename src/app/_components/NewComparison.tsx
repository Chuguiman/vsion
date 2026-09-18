"use client";

import { useState } from "react";
import Link from "next/link";
import { UploadCloud, Loader2, FileJson, Database } from "lucide-react";
import { runComparison, runComparisonFromDb, type RunResult } from "../actions";
import Results from "./Results";

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

export default function NewComparison({ carteraInfo }: { carteraInfo: { count: number; updatedAt: string | null } | null }) {
  const hasCartera = !!carteraInfo && carteraInfo.count > 0;
  const [client, setClient] = useState<File | null>(null);
  const [gazette, setGazette] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<RunResult | null>(null);

  async function run() {
    if (!gazette) return;
    if (!hasCartera && !client) return;
    setBusy(true); setRes(null);
    try {
      const gazetteText = await gazette.text();
      if (hasCartera) {
        setRes(await runComparisonFromDb(gazetteText));
      } else {
        const clientText = await client!.text();
        setRes(await runComparison(clientText, gazetteText));
      }
    } catch (e) {
      setRes({ ok: false, error: e instanceof Error ? e.message : "Error al procesar" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Nueva comparación</h1>

      {hasCartera ? (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 text-sm">
            <Database size={16} className="text-[var(--acc)]" />
            <span className="font-medium">{carteraInfo!.count.toLocaleString()} marcas</span>
            <span className="text-[var(--mut)]">en cartera</span>
            {carteraInfo!.updatedAt && (
              <span className="text-xs text-[var(--mut)]">· importada {new Date(carteraInfo!.updatedAt).toLocaleDateString("es")}</span>
            )}
            <Link href="/cartera" className="ml-auto text-xs text-[var(--acc)] hover:underline">Reemplazar cartera</Link>
          </div>
          <p className="mb-4 text-sm text-[var(--mut)]">Sube solo la gaceta. Se compara contra tu cartera guardada.</p>
          <div className="mb-4 max-w-md">
            <Drop label="Gaceta" hint="CO####.json" file={gazette} onFile={setGazette} />
          </div>
        </>
      ) : (
        <>
          <p className="mb-2 text-sm text-[var(--mut)]">Sube la cartera del cliente (casos.json) y una gaceta (CO####.json).</p>
          <p className="mb-6 text-sm text-[var(--mut)]">
            Tip: <Link href="/cartera" className="text-[var(--acc)] hover:underline">importa la cartera una sola vez</Link> y luego solo subes gacetas.
          </p>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <Drop label="Cartera del cliente" hint="casos.json" file={client} onFile={setClient} />
            <Drop label="Gaceta" hint="CO####.json" file={gazette} onFile={setGazette} />
          </div>
        </>
      )}

      <button onClick={run} disabled={!gazette || (!hasCartera && !client) || busy}
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
