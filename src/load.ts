import { readFileSync } from "node:fs";
import { computeKeys } from "./phonetics.js";
import type { ClientMark, GazetteEntry, GazetteMeta } from "./types.js";

function parseClasses(raw: unknown): number[] {
  if (raw == null) return [];
  const out = new Set<number>();
  for (const tok of String(raw).split(/[^0-9]+/)) {
    const n = parseInt(tok, 10);
    if (n >= 1 && n <= 45) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

/** casos.json → marcas del cliente. Descarta títulos vacíos. */
export function loadClientMarks(path: string): ClientMark[] {
  const rows = JSON.parse(readFileSync(path, "utf8")) as any[];
  const marks: ClientMark[] = [];
  for (const r of rows) {
    const denom = String(r.caso_titulo ?? "").trim();
    if (!denom) continue;
    marks.push({
      id: String(r.numero_de_caso_id ?? r.id ?? ""),
      code: String(r.numero_de_caso_codigo ?? ""),
      denom,
      classes: parseClasses(r.descripcion_de_productos_y_servicios),
      pys: String(r.productos_y_servicios_descripcion ?? "").trim(),
      holder: String(r.titular ?? "").trim(),
      status: String(r.estado_del_caso ?? "").trim(),
      keys: computeKeys(denom),
    });
  }
  return marks;
}

/** CO####.json → { meta, entries }. Descarta words vacíos (figurativas/3D). */
export function loadGazette(path: string): { meta: GazetteMeta; entries: GazetteEntry[]; skipped: number } {
  const doc = JSON.parse(readFileSync(path, "utf8"));
  const pub = Array.isArray(doc.publication) ? doc.publication[0] : doc.publication ?? {};
  const meta: GazetteMeta = {
    country: String(pub.codeCountry ?? ""),
    number: String(pub.number ?? ""),
    datePublic: String(pub.datePublic ?? ""),
    dateDue: String(pub.dateDue ?? ""),
    language: String(pub.idioma ?? "es"),
    count: Number(pub.cantidadRegistros ?? (doc.details?.length ?? 0)),
  };

  const entries: GazetteEntry[] = [];
  let skipped = 0;
  for (const d of doc.details ?? []) {
    const denom = String(d.word ?? "").trim();
    if (!denom) { skipped++; continue; }
    const pys = Array.isArray(d.pys)
      ? d.pys.map((p: any) => `${p.clase ? p.clase + ". " : ""}${p.descripcion ?? ""}`).join(" ").trim()
      : "";
    const applicant = Array.isArray(d.applicants) && d.applicants[0]
      ? String(d.applicants[0].aplicantName ?? "").trim() : "";
    entries.push({
      denom,
      classes: parseClasses(d.clases),
      pys,
      applicant,
      applicationNumber: String(d.applicationNumber ?? "").trim(),
      markType: String(d.markType ?? "").trim(),
      status: String(d.markStatus ?? "").trim(),
      keys: computeKeys(denom),
    });
  }
  return { meta, entries, skipped };
}
