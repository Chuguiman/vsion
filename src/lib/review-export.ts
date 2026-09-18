import type { AiVerdict, PubDTO, ReportDTO } from "./dto";

const verdicts: Record<AiVerdict, string> = {
  file_opposition: "Oponerse", monitor_closely: "Vigilar", no_action: "Sin acción",
};

export function approvedExportRows(groups: PubDTO[]) {
  return groups.flatMap((g) => g.candidates.map((c) => ({
    "Publicación": g.denom,
    "Expediente": g.applicationNumber,
    "Tipo de marca": g.markType,
    "Clases publicación": g.classes.join(", "),
    "Solicitante": g.applicant,
    "Apoderado publicación": g.representant,
    "Marca cliente": c.clientDenom,
    "Código cliente": c.clientCode,
    "Titular": c.clientHolder,
    "Estado marca": c.clientStatus,
    "Clases cliente": c.clientClasses.join(", "),
    "Score": c.score,
    "Recomendación IA": c.ai ? verdicts[c.ai.recommendation] : "Sin análisis",
    "Probabilidad IA (%)": c.ai?.prob ?? "",
    "Análisis IA": c.ai?.summary ?? "",
    "Revisión": "Aprobada",
  })));
}

export async function createApprovedExcel(groups: PubDTO[], meta: ReportDTO["meta"]) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(approvedExportRows(groups));
  sheet["!cols"] = [30, 22, 18, 18, 35, 35, 30, 22, 35, 20, 18, 10, 22, 20, 80, 15].map((wch) => ({ wch }));
  if (sheet["!ref"]) sheet["!autofilter"] = { ref: sheet["!ref"] };
  XLSX.utils.book_append_sheet(workbook, sheet, "Aprobadas");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["Gaceta", `${meta.country}${meta.number}`],
    ["Publicación", meta.datePublic], ["Oposición hasta", meta.dateDue],
    ["Revisiones aprobadas exportadas", approvedExportRows(groups).length],
  ]), "Gaceta");
  return new Blob([XLSX.write(workbook, { type: "array", bookType: "xlsx" })], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export async function createApprovedPdf(groups: PubDTO[], meta: ReportDTO["meta"]) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const rows = approvedExportRows(groups);
  const doc = new jsPDF({ orientation: "landscape", format: "a4" });
  doc.setFontSize(17);
  doc.text("vsion | Revisiones aprobadas", 14, 17);
  doc.setFontSize(10);
  doc.text(`Gaceta ${meta.country}${meta.number} | Publicación: ${meta.datePublic} | Oposición hasta: ${meta.dateDue}`, 14, 25);
  doc.text(`${rows.length} revisiones aprobadas en la vista seleccionada`, 14, 31);
  autoTable(doc, {
    startY: 37, margin: { top: 14, bottom: 17, left: 14, right: 14 },
    head: [["Publicación / expediente", "Marca cliente / titular", "Clases pub. / cliente", "Score", "Recomendación IA", "Análisis IA"]],
    body: rows.map((r) => [
      `${r.Publicación}\n${r.Expediente}\nSolicitante: ${r.Solicitante}`,
      `${r["Marca cliente"]}\n${r["Código cliente"]}\n${r.Titular}`,
      `${r["Clases publicación"] || "-"} / ${r["Clases cliente"] || "-"}`,
      r.Score,
      `${r["Recomendación IA"]}${r["Probabilidad IA (%)"] === "" ? "" : ` (${r["Probabilidad IA (%)"]}%)`}`,
      r["Análisis IA"] || "-",
    ]),
    styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [5, 120, 87] },
    columnStyles: { 0: { cellWidth: 49 }, 1: { cellWidth: 49 }, 2: { cellWidth: 25 }, 3: { cellWidth: 15 }, 4: { cellWidth: 34 }, 5: { cellWidth: 97 } },
    rowPageBreak: "avoid",
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.text(`vsion | Aprobadas | Página ${doc.getNumberOfPages()}`, 14, 202);
    },
  });
  return doc.output("blob");
}

export function downloadExport(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
