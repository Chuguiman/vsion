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

// ───────────────────────── PDF COMPLETO (fichas) ─────────────────────────

const cut = (s: string, n = 150) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s || "—");

/** Reporte profesional: portada + tabla consolidada + una ficha por caso. */
export async function createFichasPdf(groups: PubDTO[], meta: ReportDTO["meta"]) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const items = groups.flatMap((g) => g.candidates.map((c) => ({ g, c })));
  const nOpp = items.filter((x) => x.c.ai?.recommendation === "file_opposition").length;
  const nMon = items.filter((x) => x.c.ai?.recommendation === "monitor_closely").length;

  const doc = new jsPDF({ orientation: "portrait", format: "a4" });
  const W = 210, M = 14, colW = (W - M * 2 - 6) / 2;
  const ACC: [number, number, number] = [5, 120, 87];
  const MUT: [number, number, number] = [130, 130, 138];
  const TX: [number, number, number] = [30, 30, 34];

  // ── Portada ──
  doc.setFillColor(...ACC); doc.rect(0, 0, W, 40, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(20);
  doc.text("vsion · Vigilancia de marcas", M, 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.text(`Gaceta ${meta.country}${meta.number} · Colombia`, M, 30);
  doc.setFontSize(9);
  doc.text(`Publicación ${meta.datePublic} · Oposición hasta ${meta.dateDue}`, M, 36);

  const tile = (x: number, label: string, value: string, color: [number, number, number]) => {
    doc.setDrawColor(220); doc.setFillColor(248, 248, 249); doc.roundedRect(x, 50, 55, 22, 2, 2, "FD");
    doc.setTextColor(...color); doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text(value, x + 5, 63);
    doc.setTextColor(...MUT); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(label, x + 5, 69);
  };
  tile(M, "APROBADAS", String(items.length), TX);
  tile(M + 61, "OPONERSE", String(nOpp), [185, 28, 28]);
  tile(M + 122, "VIGILAR", String(nMon), [180, 83, 9]);

  doc.setTextColor(...TX); doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text("Comparaciones aprobadas para revisión", M, 86);
  doc.setFont("helvetica", "normal"); doc.setTextColor(...MUT); doc.setFontSize(9);
  doc.text(doc.splitTextToSize("Resultados del barrido fonético/textual y el análisis de IA guardado en vsion. Ordenadas: oposición primero, luego vigilancia. Requiere revisión profesional antes de actuar.", W - M * 2), M, 93);

  // ── Tabla consolidada ──
  autoTable(doc, {
    startY: 104, margin: { left: M, right: M },
    head: [["Nº", "Marca publicada", "Marca cliente", "Simil.", "IA"]],
    body: items.map((x, i) => [
      String(i + 1), x.g.denom, x.c.clientDenom, String(x.c.score),
      x.c.ai ? `${verdicts[x.c.ai.recommendation]} ${x.c.ai.prob}%` : "—",
    ]),
    styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
    headStyles: { fillColor: ACC },
    columnStyles: { 0: { cellWidth: 10 }, 3: { cellWidth: 16 }, 4: { cellWidth: 32 } },
  });

  // ── Fichas (una por caso) ──
  const field = (x: number, y: number, label: string, value: string, w: number): number => {
    doc.setFontSize(7.5); doc.setTextColor(...MUT); doc.text(label.toUpperCase(), x, y);
    doc.setFontSize(9); doc.setTextColor(...TX);
    const lines = doc.splitTextToSize(value || "—", w);
    doc.text(lines, x, y + 3.8);
    return y + 3.8 + lines.length * 4.1 + 2;
  };

  items.forEach((x, i) => {
    const { g, c } = x;
    doc.addPage();
    let y = 18;
    // cabecera de ficha
    const verdict = c.ai ? verdicts[c.ai.recommendation] : "Sin análisis";
    doc.setFillColor(...ACC); doc.rect(0, 0, W, 12, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(`COMPARACIÓN ${i + 1} / ${items.length}`, M, 8);
    doc.text(`${verdict}${c.ai ? ` · ${c.ai.prob}%` : ""} · Similitud ${c.score}`, W - M, 8, { align: "right" });
    doc.setFont("helvetica", "normal");

    // dos columnas
    const xL = M, xR = M + colW + 6;
    // títulos
    doc.setFontSize(8); doc.setTextColor(...ACC); doc.setFont("helvetica", "bold");
    doc.text("MARCA PUBLICADA (GACETA)", xL, y); doc.text("MARCA DEL CLIENTE", xR, y);
    doc.setFont("helvetica", "normal");
    let yL = y + 5, yR = y + 5;
    // denominaciones
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...TX);
    doc.text(doc.splitTextToSize(g.denom, colW), xL, yL); doc.text(doc.splitTextToSize(c.clientDenom, colW), xR, yR);
    doc.setFont("helvetica", "normal");
    yL += 6 + (doc.splitTextToSize(g.denom, colW).length - 1) * 5.5;
    yR += 6 + (doc.splitTextToSize(c.clientDenom, colW).length - 1) * 5.5;

    yL = field(xL, yL, "Expediente", g.applicationNumber, colW);
    yL = field(xL, yL, "Tipo", g.markType, colW);
    yL = field(xL, yL, "Solicitante", `${g.applicant}${g.applicantCountry ? ` (${g.applicantCountry})` : ""}`, colW);
    yL = field(xL, yL, "Apoderado", g.representant, colW);
    yL = field(xL, yL, "Fecha solicitud", g.applicationDate, colW);
    yL = field(xL, yL, "Clases Niza", g.classes.join(", "), colW);
    yL = field(xL, yL, "Productos/servicios", cut(g.pys), colW);

    yR = field(xR, yR, "Código", c.clientCode, colW);
    yR = field(xR, yR, "Estado", c.clientStatus, colW);
    yR = field(xR, yR, "Titular", `${c.clientHolder}${c.clientCountry ? ` (${c.clientCountry})` : ""}`, colW);
    yR = field(xR, yR, "Apoderado", c.clientAttorney, colW);
    yR = field(xR, yR, "Radicación · Vigencia", `${c.clientFiled || "—"} · ${c.clientValid || "—"}`, colW);
    yR = field(xR, yR, "Clases Niza", c.clientClasses.join(", "), colW);
    yR = field(xR, yR, "Productos/servicios", cut(c.clientPys), colW);

    y = Math.max(yL, yR) + 3;
    doc.setDrawColor(225); doc.line(M, y, W - M, y); y += 6;

    // bloque IA
    doc.setFontSize(8); doc.setTextColor(...MUT);
    doc.text(`SIMILITUD ${c.score}/100  ·  CLASES EN COMÚN: ${c.matchingClasses.join(", ") || "—"}  ·  RELACIONADAS: ${c.relatedClasses.join(", ") || "—"}`, M, y); y += 6;
    if (c.ai) {
      y = field(M, y, `Recomendación IA — ${verdicts[c.ai.recommendation]} (${c.ai.prob}%)`, "", W - M * 2);
      y -= 4;
      y = field(M, y, "Resumen del agente", c.ai.summary, W - M * 2);
      y = field(M, y, "Razonamiento guardado", c.ai.reasoning, W - M * 2);
    } else {
      doc.setFontSize(9); doc.setTextColor(...MUT); doc.text("Sin análisis de IA para este caso.", M, y);
    }
    // pie
    doc.setFontSize(7); doc.setTextColor(...MUT);
    doc.text("vsion · texto de IA reproducido sin modificar · requiere revisión profesional antes de actuar", M, 290);
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
