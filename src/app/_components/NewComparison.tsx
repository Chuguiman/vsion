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

function Step({ n, title, sub, children }: { n: number; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--acc)] text-xs font-semibold text-black">{n}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-[var(--mut)]">{sub}</span>
      </div>
      {children}
    </section>
  );
}

function SourceCard({ active, disabled, onClick, icon, title, desc }: {
  active: boolean; disabled?: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active}
      className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? "border-[var(--acc)] bg-[var(--acc)]/10" : "border-[var(--bd)] bg-[var(--bg2)] hover:border-[var(--acc)]"}`}>
      <div className={`flex items-center gap-1.5 text-sm font-medium ${active ? "text-[var(--acc)]" : ""}`}>{icon} {title}</div>
      <div className="mt-1 text-xs text-[var(--mut)]">{desc}</div>
    </button>
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
      .then((r) => {
        if (!alive) return;
        const list = r.gazettes ?? [];
        setGazettes(list); setGazetteId("");
        if (!list.length) setSource("upload");
      })
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
        r = await runComparisonFromDb(gazette, oid);
      } else {
        if (!gazette || !client) return;
        r = await runComparison(client, gazette, oid);
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

  // El botón dice qué gaceta se va a comparar.
  const chosen = hasCartera && source === "reuse"
    ? gazettes.find((g) => String(g.id) === gazetteId)
    : null;
  const target = chosen ? `${chosen.country}${chosen.number}` : gazette?.name.replace(/\.json$/i, "");
  const runLabel = target ? `Comparar ${target} con la cartera` : "Comparar";

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Nueva comparación</h1>

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
          {/* Paso 1: la cartera del cliente ya está en la BD; no se sube aquí. */}
          <Step n={1} title="Cartera del cliente" sub="Marcas propias a vigilar · guardadas en la base de datos">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 text-sm">
              <Database size={16} className="text-[var(--acc)]" />
              <span className="font-medium">{info!.count.toLocaleString()} marcas</span>
              <span className="text-[var(--mut)]">en cartera</span>
              {info!.updatedAt && (
                <span className="text-xs text-[var(--mut)]">· importada {new Date(info!.updatedAt).toLocaleDateString("es")}</span>
              )}
              <Link href="/cartera" className="ml-auto text-xs text-[var(--acc)] hover:underline">Reemplazar cartera</Link>
            </div>
          </Step>

          {/* Paso 2: la publicación (gaceta) contra la que se compara. Dos alternativas. */}
          <Step n={2} title="Publicación a comparar" sub="Gaceta oficial con las solicitudes de terceros">
            <div className="grid gap-2 sm:grid-cols-2">
              <SourceCard active={source === "upload"} onClick={() => setSource("upload")}
                icon={<FileJson size={16} />} title="Gaceta nueva"
                desc="Subir el JSON de una gaceta que aún no está en el sistema (p. ej. CO1115.json)." />
              <SourceCard active={source === "reuse"} onClick={() => setSource("reuse")} disabled={gazettes.length === 0}
                icon={<Archive size={16} />}
                title={`Gaceta ya cargada${gazettes.length > 0 ? ` (${gazettes.length})` : ""}`}
                desc={gazettes.length > 0
                  ? "Comparar con una gaceta que ya está en el sistema, sin volver a subir el archivo."
                  : "No hay ninguna disponible: las gacetas ya cargadas ya fueron comparadas por esta organización."} />
            </div>

            <div className="mt-3 max-w-md">
              {source === "upload" ? (
                <Drop label="Archivo de la gaceta" hint="CO####.json (con imágenes ya procesadas)" file={gazette} onFile={setGazette} />
              ) : (
                <StyledSelect value={gazetteId} onChange={setGazetteId} ariaLabel="Gaceta ya cargada"
                  options={[{ value: "", label: "Elige una gaceta…" }, ...gazettes.map((g) => ({
                    value: String(g.id), label: `${g.country}${g.number} · ${g.pub_count.toLocaleString()} publicaciones${g.date_public ? ` · ${g.date_public}` : ""}`,
                  }))]} />
              )}
            </div>
          </Step>
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
        {busy ? "Procesando..." : runLabel}
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
