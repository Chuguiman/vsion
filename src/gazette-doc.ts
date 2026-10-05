// Parseo del documento de gaceta SIN dependencias de Node: se usa tanto en el
// servidor como en el navegador (que extrae solo los campos útiles y los envía
// por lotes, sin chocar con el límite de body de Vercel).
import type { GazetteMeta } from "./types";

export function parseClasses(raw: unknown): number[] {
  if (raw == null) return [];
  const out = new Set<number>();
  for (const tok of String(raw).split(/[^0-9]+/)) {
    const n = parseInt(tok, 10);
    if (n >= 1 && n <= 45) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

// Las fuentes no coinciden en los nombres: SIC (CO) usa "aplicantName"/"clases";
// otis (PE, EC, …) usa "applicantName"/"classes". Se aceptan ambas variantes.

/** Primer solicitante/titular: nombre y país. */
export function firstApplicant(d: any): { name: string; country: string } {
  const ap = Array.isArray(d?.applicants) && d.applicants[0] ? d.applicants[0] : {};
  return {
    name: String(ap.aplicantName ?? ap.applicantName ?? "").trim(),
    country: String(ap.aplicantCountry ?? ap.applicantCountry ?? "").trim().toUpperCase(),
  };
}

/** Clases Niza del registro; si no vienen, se toman de pys[].clase. */
export function detailClasses(d: any): number[] {
  const raw = d?.clases ?? d?.classes;
  const out = parseClasses(raw);
  if (out.length || !Array.isArray(d?.pys)) return out;
  return parseClasses(d.pys.map((p: any) => p?.clase).join(","));
}

/** Cabecera de la gaceta (publication[0]). */
export function parseGazetteMeta(doc: any): GazetteMeta {
  const pub = (Array.isArray(doc?.publication) ? doc.publication[0] : doc?.publication) ?? {};
  return {
    country: String(pub.codeCountry ?? "").trim().toUpperCase(),
    number: String(pub.number ?? "").trim(),
    datePublic: String(pub.datePublic ?? ""),
    dateDue: String(pub.dateDue ?? ""),
    language: String(pub.idioma ?? "es"),
    count: Number(pub.cantidadRegistros ?? (doc?.details?.length ?? 0)),
  };
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
  for (const d of doc?.details ?? []) {
    const pys = Array.isArray(d.pys)
      ? d.pys.map((p: any) => `${p.clase ? p.clase + ". " : ""}${p.descripcion ?? ""}`).join(" ").trim()
      : "";
    const ap = firstApplicant(d);
    const representant = Array.isArray(d.representants) && d.representants[0]
      ? String(d.representants[0].representant_name ?? "").trim() : "";
    out.push({
      seq: seq++,
      denom: String(d.word ?? "").trim(),
      markCategory: String(d.markCategory ?? "").trim(),
      classes: detailClasses(d),
      pys,
      applicant: ap.name,
      applicantCountry: ap.country,
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
