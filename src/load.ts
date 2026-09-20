import { readFileSync } from "node:fs";
import { computeKeys } from "./phonetics";
import type { ClientMark, GazetteEntry, GazetteMeta } from "./types";

function parseClasses(raw: unknown): number[] {
  if (raw == null) return [];
  const out = new Set<number>();
  for (const tok of String(raw).split(/[^0-9]+/)) {
    const n = parseInt(tok, 10);
    if (n >= 1 && n <= 45) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

/** Filas de casos.json (ya parseadas) → marcas del cliente. */
export function parseClientMarks(rows: any[]): ClientMark[] {
  const marks: ClientMark[] = [];
  for (const r of rows) {
    const denom = String(r.caso_titulo ?? "").trim();
    if (!denom) continue;
    // titular: "NOMBRE, DIRECCION, CIUDAD, DEPTO, PAIS" → nombre = [0], país = último token corto
    const titularParts = String(r.titular ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
    const last = titularParts[titularParts.length - 1] ?? "";
    const country = last.length <= 3 ? last.toUpperCase() : "";
    marks.push({
      id: String(r.numero_de_caso_id ?? r.id ?? ""),
      code: String(r.numero_de_caso_codigo ?? ""),
      denom,
      classes: parseClasses(r.descripcion_de_productos_y_servicios),
      pys: String(r.productos_y_servicios_descripcion ?? "").trim(),
      holder: titularParts[0] ?? "",
      attorney: String(r.apoderado ?? "").split(",")[0].trim(),
      status: String(r.estado_del_caso ?? "").trim(),
      country,
      filedDate: String(r.fecha_de_radicacion ?? "").trim(),
      validUntil: String(r.vigencia ?? "").trim(),
      registerDate: String(r.fecha_de_registro ?? "").trim(),
      keys: computeKeys(denom),
    });
  }
  return marks;
}

/** casos.json → marcas del cliente. Descarta títulos vacíos. */
export function loadClientMarks(path: string): ClientMark[] {
  return parseClientMarks(JSON.parse(readFileSync(path, "utf8")) as any[]);
}

/** Documento de gaceta (ya parseado) → { meta, entries }. */
export function parseGazette(doc: any): { meta: GazetteMeta; entries: GazetteEntry[]; skipped: number } {
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
    const ap = Array.isArray(d.applicants) && d.applicants[0] ? d.applicants[0] : {};
    const applicant = String(ap.aplicantName ?? "").trim();
    const applicantCountry = String(ap.aplicantCountry ?? "").trim().toUpperCase();
    const representant = Array.isArray(d.representants) && d.representants[0]
      ? String(d.representants[0].representant_name ?? "").trim() : "";
    entries.push({
      denom,
      classes: parseClasses(d.clases),
      pys,
      applicant,
      applicantCountry,
      representant,
      applicationNumber: String(d.applicationNumber ?? "").trim(),
      applicationDate: String(d.applicationDate ?? "").trim(),
      priority: String(d.prioridad ?? "").trim(),
      markType: String(d.markType ?? "").trim(),
      status: String(d.markStatus ?? "").trim(),
      image: String(d.image ?? "").trim(),
      keys: computeKeys(denom),
    });
  }
  return { meta, entries, skipped };
}

/** CO####.json → { meta, entries }. Descarta words vacíos (figurativas/3D). */
export function loadGazette(path: string): { meta: GazetteMeta; entries: GazetteEntry[]; skipped: number } {
  return parseGazette(JSON.parse(readFileSync(path, "utf8")));
}

export interface PublicationRow {
  seq: number;
  denom: string;
  markCategory: string;
  classes: number[];
  pys: string;
  applicant: string;
  applicantCountry: string;
  representant: string;
  applicationNumber: string;
  applicationDate: string;
  markType: string;
  status: string;
  imageId: string;
}

/** Todas las publicaciones de la gaceta, incluidas las figurativas (word vacío). */
export function parseAllPublications(doc: any): PublicationRow[] {
  const out: PublicationRow[] = [];
  let seq = 0;
  for (const d of doc.details ?? []) {
    const pys = Array.isArray(d.pys)
      ? d.pys.map((p: any) => `${p.clase ? p.clase + ". " : ""}${p.descripcion ?? ""}`).join(" ").trim()
      : "";
    const ap = Array.isArray(d.applicants) && d.applicants[0] ? d.applicants[0] : {};
    const representant = Array.isArray(d.representants) && d.representants[0]
      ? String(d.representants[0].representant_name ?? "").trim() : "";
    out.push({
      seq: seq++,
      denom: String(d.word ?? "").trim(),
      markCategory: String(d.markCategory ?? "").trim(),
      classes: parseClasses(d.clases),
      pys,
      applicant: String(ap.aplicantName ?? "").trim(),
      applicantCountry: String(ap.aplicantCountry ?? "").trim().toUpperCase(),
      representant,
      applicationNumber: String(d.applicationNumber ?? "").trim(),
      applicationDate: String(d.applicationDate ?? "").trim(),
      markType: String(d.markType ?? "").trim(),
      status: String(d.markStatus ?? "").trim(),
      imageId: String(d.image ?? "").trim(),
    });
  }
  return out;
}
