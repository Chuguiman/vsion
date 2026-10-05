"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileJson, Loader2, UploadCloud, Pencil, Trash2, Eye, Check, X } from "lucide-react";
import type { GazetteRow } from "@/lib/gazettes";
import type { GazetteMeta } from "@/types";
import { findGazetteAction, updateGazetteAction, deleteGazetteAction } from "../gazettes-actions";
import { readGazetteFile, uploadGazetteDoc } from "./uploadGazette";

const fmtDate = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString("es") : "—");
const flag = (c: string) => <span className={`fi fi-${c.toLowerCase()} mr-1.5 rounded-sm`} aria-hidden="true" />;

function Uploader() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ meta: GazetteMeta; doc: any; total: number; existing: GazetteRow | null } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function pick(f: File | null) {
    setFile(f); setPreview(null); setMsg(null); setProgress(null);
    if (!f) return;
    setBusy(true);
    try {
      const { meta, doc } = await readGazetteFile(f);
      const found = await findGazetteAction(meta.country, meta.number);
      setPreview({ meta, doc, total: doc.details.length, existing: found.ok ? found.gazette : null });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "No se pudo leer el archivo." });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!preview) return;
    if (preview.existing?.pub_count && !confirm(
      `${preview.meta.country}${preview.meta.number} ya está cargada con ${preview.existing.pub_count} publicaciones. ¿Reemplazarlas?`)) return;
    setBusy(true); setMsg(null);
    try {
      await uploadGazetteDoc(preview.meta, preview.doc, (done, total) => setProgress({ done, total }));
      setMsg({ ok: true, text: `${preview.meta.country}${preview.meta.number} cargada: ${preview.total.toLocaleString()} publicaciones.` });
      setFile(null); setPreview(null);
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Error al cargar." });
    } finally {
      setBusy(false); setProgress(null);
    }
  }

  return (
    <section className="mb-8 rounded-xl border border-[var(--bd)] bg-[var(--bg2)] p-4">
      <h2 className="mb-3 text-sm font-semibold">Cargar publicación</h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-[var(--bd)] px-4 py-3 hover:border-[var(--acc)]">
          <input type="file" accept=".json,application/json" className="hidden" disabled={busy}
            onChange={(e) => { pick(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          <FileJson size={22} className="shrink-0 text-[var(--mut)]" />
          <span className="min-w-0 text-sm">
            <span className="block truncate font-medium">{file ? file.name : "Elegir JSON de gaceta"}</span>
            <span className="block text-xs text-[var(--mut)]">CO####.json, EC###.json, PE###.json… (cualquier tamaño)</span>
          </span>
        </label>
        <button onClick={save} disabled={!preview || busy}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--acc)] px-4 py-2 text-sm font-medium text-black disabled:opacity-40">
          {busy ? <Loader2 className="animate-spin" size={16} /> : <UploadCloud size={16} />}
          {preview?.existing?.pub_count ? "Reemplazar" : "Guardar"}
        </button>
      </div>

      {preview && (
        <p className="mt-3 text-sm">
          {flag(preview.meta.country)}<span className="font-medium">{preview.meta.country}{preview.meta.number}</span>
          <span className="text-[var(--mut)]"> · {preview.total.toLocaleString()} publicaciones
            {preview.meta.datePublic && ` · publicada ${fmtDate(preview.meta.datePublic)}`}</span>
          {preview.existing && <span className="ml-2 text-xs text-amber-400">ya existe ({preview.existing.pub_count} publicaciones)</span>}
        </p>
      )}
      {progress && (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bd)]">
            <div className="h-full bg-[var(--acc)] transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-[var(--mut)]">{progress.done.toLocaleString()} de {progress.total.toLocaleString()}</p>
        </div>
      )}
      {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
    </section>
  );
}

function Row({ g }: { g: GazetteRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ datePublic: g.date_public ?? "", dateDue: g.date_due ?? "", language: g.language ?? "es" });

  async function save() {
    setBusy(true);
    const r = await updateGazetteAction(g.id, form);
    setBusy(false);
    if (!r.ok) return alert(r.error);
    setEditing(false); router.refresh();
  }
  async function remove() {
    if (!confirm(`¿Borrar ${g.country}${g.number} y sus ${g.pub_count} publicaciones?`)) return;
    setBusy(true);
    const r = await deleteGazetteAction(g.id);
    setBusy(false);
    if (!r.ok) return alert(r.error);
    router.refresh();
  }

  const input = "w-full rounded border border-[var(--bd)] bg-[var(--bg)] px-2 py-1 text-xs";
  return (
    <tr className="border-b border-[var(--bd)] last:border-0 hover:bg-white/5">
      <td className="px-3 py-2 font-medium whitespace-nowrap">{flag(g.country)}{g.country}{g.number}</td>
      <td className="px-3 py-2">{editing
        ? <input type="date" className={input} value={form.datePublic} onChange={(e) => setForm({ ...form, datePublic: e.target.value })} />
        : fmtDate(g.date_public)}</td>
      <td className="px-3 py-2">{editing
        ? <input type="date" className={input} value={form.dateDue} onChange={(e) => setForm({ ...form, dateDue: e.target.value })} />
        : fmtDate(g.date_due)}</td>
      <td className="px-3 py-2">{editing
        ? <input className={`${input} w-14`} value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
        : g.language ?? "—"}</td>
      <td className="px-3 py-2 text-right tabular-nums">{g.pub_count.toLocaleString()}</td>
      <td className="px-3 py-2 text-right tabular-nums">{g.run_count}</td>
      <td className="px-3 py-2 text-[var(--mut)]">{fmtDate(g.created_at)}</td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-3 text-[var(--mut)]">
          {busy ? <Loader2 size={15} className="animate-spin" /> : editing ? (
            <>
              <button onClick={save} title="Guardar" className="hover:text-emerald-400"><Check size={15} /></button>
              <button onClick={() => setEditing(false)} title="Cancelar" className="hover:text-[var(--tx)]"><X size={15} /></button>
            </>
          ) : (
            <>
              <Link href={`/publicaciones/${g.id}`} title="Ver publicaciones" className="hover:text-[var(--tx)]"><Eye size={15} /></Link>
              <button onClick={() => setEditing(true)} title="Editar fechas" className="hover:text-[var(--tx)]"><Pencil size={15} /></button>
              <button onClick={remove} title={g.run_count ? "En uso por comparaciones" : "Borrar"} disabled={g.run_count > 0}
                className="hover:text-red-400 disabled:opacity-30 disabled:hover:text-[var(--mut)]"><Trash2 size={15} /></button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function GazettesManager({ gazettes }: { gazettes: GazetteRow[] }) {
  return (
    <div>
      <Uploader />
      {gazettes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--bd)] px-4 py-8 text-center text-sm text-[var(--mut)]">Aún no hay publicaciones cargadas.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--bd)] bg-[var(--bg2)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-[var(--mut)]">
                <th className="px-3 py-2 font-medium">Gaceta</th>
                <th className="px-3 py-2 font-medium">Publicada</th>
                <th className="px-3 py-2 font-medium">Vence oposición</th>
                <th className="px-3 py-2 font-medium">Idioma</th>
                <th className="px-3 py-2 text-right font-medium">Publicaciones</th>
                <th className="px-3 py-2 text-right font-medium">Comparaciones</th>
                <th className="px-3 py-2 font-medium">Cargada</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>{gazettes.map((g) => <Row key={g.id} g={g} />)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
