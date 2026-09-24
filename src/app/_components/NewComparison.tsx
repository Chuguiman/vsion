"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2, FileJson, Database, Archive } from "lucide-react";
import {
  runComparison, runComparisonFromDb, runComparisonFromGazetteAction,
  carteraInfoAction, listReusableGazettesAction, type RunResult,
} from "../actions";
import type { ReusableGazette } from "@/lib/gazettes";
import Results from "./Results";
import StyledSelect from "./StyledSelect";

function Drop({ label, hint, file, onFile }: {
  label: string; hint: string; file: File | null; onFile: (f: File | null) => void;
}) {
  return (
    <label className="flex w-full cursor-pointer flex-col items-center rounded-xl border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-6 text-center hover:border-[var(--acc)]">
      <input type="file" accept=".json,application/json" className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      <FileJson className="mb-2 text-[var(--mut)]" size={26} />
      <div className="font-medium">{label}</div>
      <div className="mt-1 text-xs text-[var(--mut)]">{file ? file.name : hint}</div>
    </label>
  );
}

export default function NewComparison({ carteraInfo, orgs = [], isSuper = false }: {
  carteraInfo: { count: number; updatedAt: string | null } | null;
  orgs?: { id: number; name: string }[];
  isSuper?: boolean;
}) {
  const router = useRouter();
  const [client, setClient] = useState<File | null>(null);
  const [gazette, setGazette] = useState<File | null>(null);
  const [orgId, setOrgId] = useState<string>(orgs.length === 1 ? String(orgs[0].id) : "");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<RunResult | null>(null);
  // superadmin: la cartera se resuelve por la org elegida; los demás usan la suya.
  const [info, setInfo] = useState(carteraInfo);
  // Fuente de la publicación: subir archivo o elegir una gaceta ya cargada.
  const [source, setSource] = useState<"upload" | "reuse">("upload");
  const [gazettes, setGazettes] = useState<ReusableGazette[]>([]);
  const [gazetteId, setGazetteId] = useState<string>("");
  const needsOrg = isSuper && !orgId;
  const hasCartera = !!info && info.count > 0;
  const oid = orgId ? Number(orgId) : null;

  useEffect(() => {
    if (!isSuper) return;
    if (!orgId) { setInfo(null); return; }
    let alive = true;
    carteraInfoAction(Number(orgId)).then((r) => { if (alive) setInfo(r); }).catch(() => { if (alive) setInfo(null); });
    return () => { alive = false; };
  }, [orgId, isSuper]);

  // Gacetas reutilizables (país habilitado + con publicaciones + no comparadas por la org).
  useEffect(() => {
    if (isSuper && !orgId) { setGazettes([]); setGazetteId(""); return; }
    let alive = true;
    listReusableGazettesAction(isSuper ? Number(orgId) : null)
      .then((r) => { if (alive) { setGazettes(r.gazettes ?? []); setGazetteId(""); } })
      .catch(() => { if (alive) setGazettes([]); });
    return () => { alive = false; };
  }, [orgId, isSuper]);

  async function run() {
    if (needsOrg) return;
    setBusy(true); setRes(null);
    try {
      let r: RunResult;
      if (hasCartera && source === "reuse") {
        if (!gazetteId) return;
        r = await runComparisonFromGazetteAction(Number(gazetteId), oid);
      } else if (hasCartera) {
        if (!gazette) return;
        r = await runComparisonFromDb(await gazette.text(), oid);
      } else {
        if (!gazette || !client) return;
        r = await runComparison(await client.text(), await gazette.text(), oid);
      }
      // Guardó en historial → ir a la vista de resultados dedicada.
      if (r.ok && r.runId) { router.push(`/runs/${r.runId}`); return; }
      setRes(r); // sin BD: mostrar inline como fallback
    } catch (e) {
      setRes({ ok: false, error: e instanceof Error ? e.message : "Error al procesar" });
    } finally {
      setBusy(false);
    }
  }

  const canRun = !needsOrg && !busy && (
    hasCartera ? (source === "reuse" ? !!gazetteId : !!gazette) : (!!gazette && !!client)
  );

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Nueva comparación</h1>

      {isSuper && (
        <div className="mb-5 max-w-md">
          <label className="mb-1 block text-xs font-medium text-[var(--mut)]">Organización de esta corrida</label>
          <StyledSelect value={orgId} onChange={setOrgId} ariaLabel="Organización de esta corrida"
            options={[{ value: "", label: "Elige una organización…" }, ...orgs.map((o) => ({ value: String(o.id), label: o.name }))]} />
          {orgs.length === 0 && <p className="mt-1 text-xs text-amber-400">No hay organizaciones. Crea una en Usuarios.</p>}
        </div>
      )}

      {hasCartera ? (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 text-sm">
            <Database size={16} className="text-[var(--acc)]" />
            <span className="font-medium">{info!.count.toLocaleString()} marcas</span>
            <span className="text-[var(--mut)]">en cartera</span>
            {info!.updatedAt && (
              <span className="text-xs text-[var(--mut)]">· importada {new Date(info!.updatedAt).toLocaleDateString("es")}</span>
            )}
            <Link href="/cartera" className="ml-auto text-xs text-[var(--acc)] hover:underline">Reemplazar cartera</Link>
          </div>
          <p className="mb-3 text-sm text-[var(--mut)]">Compara contra tu cartera guardada: sube la publicación o elige una gaceta ya cargada.</p>

          {/* Pestañas: subir archivo o reutilizar una gaceta ya cargada */}
          <div className="mb-4 inline-flex rounded-lg border border-[var(--bd)] bg-[var(--bg2)] p-0.5 text-sm">
            <button type="button" onClick={() => setSource("upload")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${source === "upload" ? "bg-[var(--acc)] text-black" : "text-[var(--mut)] hover:text-[var(--tx)]"}`}>
              <FileJson size={15} /> Subir archivo
            </button>
            <button type="button" onClick={() => setSource("reuse")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${source === "reuse" ? "bg-[var(--acc)] text-black" : "text-[var(--mut)] hover:text-[var(--tx)]"}`}>
              <Archive size={15} /> Gaceta cargada{gazettes.length > 0 ? ` (${gazettes.length})` : ""}
            </button>
          </div>

          {source === "upload" ? (
            <div className="mb-4 max-w-md">
              <Drop label="Publicación" hint="CO####.json" file={gazette} onFile={setGazette} />
            </div>
          ) : (
            <div className="mb-4 max-w-md">
              <label className="mb-1 block text-xs font-medium text-[var(--mut)]">Gaceta ya cargada</label>
              <StyledSelect value={gazetteId} onChange={setGazetteId} ariaLabel="Gaceta ya cargada"
                options={[{ value: "", label: "Elige una gaceta…" }, ...gazettes.map((g) => ({
                  value: String(g.id), label: `${g.country}${g.number} · ${g.pub_count.toLocaleString()} publicaciones${g.date_public ? ` · ${g.date_public}` : ""}`,
                }))]} />
              <p className="mt-1.5 text-xs text-[var(--mut)]">
                {gazettes.length === 0
                  ? "No hay gacetas pendientes. Aparecen las de países habilitados en Países, con publicaciones y que esta organización aún no comparó."
                  : "Reutiliza las publicaciones e imágenes ya cargadas; no vuelve a subir el archivo."}
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="mb-2 text-sm text-[var(--mut)]">Sube la cartera del cliente (casos.json) y una gaceta (CO####.json).</p>
          <p className="mb-6 text-sm text-[var(--mut)]">
            Tip: <Link href="/cartera" className="text-[var(--acc)] hover:underline">importa la cartera una sola vez</Link> y luego solo subes gacetas.
          </p>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Drop label="Cartera del cliente" hint="casos.json" file={client} onFile={setClient} />
            <Drop label="Publicación" hint="CO####.json" file={gazette} onFile={setGazette} />
          </div>
        </>
      )}

      <button onClick={run} disabled={!canRun}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--acc)] px-4 py-2 font-medium text-black disabled:opacity-40">
        {busy ? <Loader2 className="animate-spin" size={16} /> : <UploadCloud size={16} />}
        {busy ? "Procesando..." : "Comparar"}
      </button>
      {needsOrg && <p className="mt-2 text-xs text-[var(--mut)]">Selecciona la organización para habilitar la comparación.</p>}

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
