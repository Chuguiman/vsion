/**
 * Export a XLSX (SheetJS). Una fila por candidato.
 */
import * as XLSX from "xlsx";
import type { Candidate, GazetteMeta } from "./types.js";

const REC_LABEL: Record<string, string> = {
  file_opposition: "Oponerse",
  monitor_closely: "Vigilar",
  no_action: "Sin acción",
};

export function writeXlsx(cands: Candidate[], meta: GazetteMeta, outPath: string): void {
  const rows = cands.map((c) => ({
    "Gaceta": `${meta.country}${meta.number}`,
    "Relación": c.sameOwner ? "Aviso publicación (mismo titular)" : "Confusión (analizado)",
    "Solicitud (nueva)": c.gazette.denom,
    "N.º solicitud": c.gazette.applicationNumber,
    "Tipo": c.gazette.markType,
    "Clases solicitud": c.gazette.classes.join(", "),
    "Solicitante": c.gazette.applicant,
    "Representante gaceta": c.gazette.representant,
    "Marca cliente": c.client.denom,
    "Código cliente": c.client.code,
    "Estado cliente": c.client.status,
    "Clases cliente": c.client.classes.join(", "),
    "Titular": c.client.holder,
    "Apoderado": c.client.attorney,
    "Mismo titular": c.sameOwner ? "Sí" : "No",
    "Mismo apoderado": c.sameAttorney ? "Sí" : "No",
    "Score": c.score,
    "Clases en común": c.matchingClasses.join(", "),
    "Clases relacionadas": c.relatedClasses.join(", "),
    "Veredicto IA": c.sameOwner ? "Tu marca (aviso)" : REC_LABEL[c.ai?.recommendation ?? "no_action"],
    "Prob. éxito %": c.ai?.success_probability ?? "",
    "Resumen IA": c.ai?.summary ?? "",
    "Razonamiento IA": c.ai?.reasoning ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 10 }, { wch: 30 }, { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 28 }, { wch: 26 },
    { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 28 }, { wch: 26 }, { wch: 12 }, { wch: 14 },
    { wch: 7 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 11 }, { wch: 50 }, { wch: 60 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Coincidencias");
  XLSX.writeFile(wb, outPath);
}
