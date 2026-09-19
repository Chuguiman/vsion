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
  const W = 210, H = 297, M = 14, colW = (W - M * 2 - 8) / 2;
  const ACC: [number, number, number] = [124, 58, 237];
  const MUT: [number, number, number] = [128, 128, 136];
  const TX: [number, number, number] = [33, 33, 38];
  const RED: [number, number, number] = [185, 28, 28];
  const AMBER: [number, number, number] = [180, 83, 9];
  // Escala tipográfica unificada
  const F = { title: 15, h2: 10.5, section: 8, label: 7, value: 9, small: 7.5, tile: 13 };

  // Etiqueta gris (uppercase) + valor, ancho w. Devuelve nueva y.
  const field = (x: number, y: number, lbl: string, value: string, w: number): number => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(F.label); doc.setTextColor(...MUT);
    doc.text(lbl.toUpperCase(), x, y);
    doc.setFontSize(F.value); doc.setTextColor(...TX);
    const lines = doc.splitTextToSize(value || "—", w);
    doc.text(lines, x, y + 3.6);
    return y + 3.6 + lines.length * 4 + 2.4;
  };

  // ── Portada compacta ──
  doc.setFont("helvetica", "bold"); doc.setFontSize(F.title); doc.setTextColor(...TX);
  doc.text("vsion · Vigilancia de marcas", M, 18);
  doc.setFont("helvetica", "normal"); doc.setFontSize(F.small); doc.setTextColor(...MUT);
  doc.text(`Gaceta ${meta.country}${meta.number} · Colombia · Publicada ${meta.datePublic} · Oposición hasta ${meta.dateDue}`, M, 24);
  doc.setDrawColor(...ACC); doc.setLineWidth(0.6); doc.line(M, 27, W - M, 27); doc.setLineWidth(0.2);

  // Tiles compactos (misma altura/fuentes)
  const tiles: [string, string, [number, number, number]][] = [
    ["Aprobadas", String(items.length), TX],
    ["Oponerse", `${nOpp} · ${items.length ? Math.round((100 * nOpp) / items.length) : 0}%`, RED],
    ["Vigilar", `${nMon} · ${items.length ? Math.round((100 * nMon) / items.length) : 0}%`, AMBER],
  ];
  const tw = (W - M * 2 - 8) / 3, ty = 33, th = 17;
  tiles.forEach(([lbl, val, col], i) => {
    const x = M + i * (tw + 4);
    doc.setDrawColor(224); doc.setFillColor(249, 249, 250); doc.roundedRect(x, ty, tw, th, 2, 2, "FD");
    doc.setFont("helvetica", "normal"); doc.setFontSize(F.label); doc.setTextColor(...MUT);
    doc.text(lbl.toUpperCase(), x + 4, ty + 6);
    doc.setFont("helvetica", "bold"); doc.setFontSize(F.tile); doc.setTextColor(...col);
    doc.text(val, x + 4, ty + 13.5);
  });

  doc.setFont("helvetica", "normal"); doc.setFontSize(F.small); doc.setTextColor(...MUT);
  doc.text(doc.splitTextToSize("Comparaciones aprobadas para revisión. Orden: oposición primero, luego vigilancia. Texto de IA reproducido sin modificar; requiere revisión profesional antes de actuar.", W - M * 2), M, ty + th + 7);

  // Tabla consolidada (misma página)
  autoTable(doc, {
    startY: ty + th + 16, margin: { left: M, right: M },
    head: [["Nº", "Marca publicada", "Marca cliente", "Simil.", "IA"]],
    body: items.map((x, i) => [
      String(i + 1), x.g.denom, x.c.clientDenom, String(x.c.score),
      x.c.ai ? `${verdicts[x.c.ai.recommendation]} ${x.c.ai.prob}%` : "—",
    ]),
    styles: { font: "helvetica", fontSize: F.small, cellPadding: 2.2, overflow: "linebreak", textColor: TX },
    headStyles: { fillColor: ACC, fontSize: F.label, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 9 }, 3: { cellWidth: 15 }, 4: { cellWidth: 30 } },
  });

  // ── Fichas (una por caso) ──
  items.forEach((x, i) => {
    const { g, c } = x;
    doc.addPage();
    // barra superior slim (misma altura en todas)
    doc.setFillColor(...ACC); doc.rect(0, 0, W, 10, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(F.section);
    doc.text(`COMPARACIÓN ${i + 1} / ${items.length}  ·  APROBADA`, M, 6.6);
    doc.text(`${c.ai ? verdicts[c.ai.recommendation] : "Sin análisis"}${c.ai ? ` · ${c.ai.prob}%` : ""}  ·  Similitud ${c.score}`, W - M, 6.6, { align: "right" });
    doc.setFont("helvetica", "normal");

    let y = 18;
    const xL = M, xR = M + colW + 8;
    // títulos de columna
    doc.setFont("helvetica", "bold"); doc.setFontSize(F.section); doc.setTextColor(...ACC);
    doc.text("MARCA PUBLICADA (GACETA)", xL, y); doc.text("MARCA DEL CLIENTE", xR, y);
    doc.setFont("helvetica", "normal");
    // denominaciones (mismo tamaño ambas columnas)
    doc.setFont("helvetica", "bold"); doc.setFontSize(F.h2); doc.setTextColor(...TX);
    const gL = doc.splitTextToSize(g.denom, colW), cL = doc.splitTextToSize(c.clientDenom, colW);
    doc.text(gL, xL, y + 6); doc.text(cL, xR, y + 6);
    doc.setFont("helvetica", "normal");
    let yL = y + 6 + gL.length * 4.6 + 1.5;
    let yR = y + 6 + cL.length * 4.6 + 1.5;

    yL = field(xL, yL, "Expediente", g.applicationNumber, colW);
    yL = field(xL, yL, "Tipo", g.markType, colW);
    yL = field(xL, yL, "Solicitante", `${g.applicant}${g.applicantCountry ? ` (${g.applicantCountry})` : ""}`, colW);
    yL = field(xL, yL, "Apoderado", g.representant, colW);
    yL = field(xL, yL, "Fecha de solicitud", g.applicationDate, colW);
    yL = field(xL, yL, "Clases Niza", g.classes.join(", "), colW);
    yL = field(xL, yL, "Productos / servicios", cut(g.pys), colW);

    yR = field(xR, yR, "Código", c.clientCode, colW);
    yR = field(xR, yR, "Estado", c.clientStatus, colW);
    yR = field(xR, yR, "Titular", `${c.clientHolder}${c.clientCountry ? ` (${c.clientCountry})` : ""}`, colW);
    yR = field(xR, yR, "Apoderado", c.clientAttorney, colW);
    yR = field(xR, yR, "Radicación · Vigencia", `${c.clientFiled || "—"} · ${c.clientValid || "—"}`, colW);
    yR = field(xR, yR, "Clases Niza", c.clientClasses.join(", "), colW);
    yR = field(xR, yR, "Productos / servicios", cut(c.clientPys), colW);

    y = Math.max(yL, yR) + 3;
    doc.setDrawColor(226); doc.line(M, y, W - M, y); y += 6;

    // fila de métricas (mismas fuentes que field)
    const metricW = (W - M * 2 - 8) / 3;
    y = Math.max(
      field(xL, y, "Similitud", `${c.score} / 100`, metricW),
      field(xL + metricW + 4, y, "Recomendación IA", c.ai ? verdicts[c.ai.recommendation] : "—", metricW),
      field(xL + (metricW + 4) * 2, y, "Estimación IA", c.ai ? `${c.ai.prob} %` : "—", metricW),
    );
    y = field(M, y, "Clases exactas en común / relacionadas", `${c.matchingClasses.join(", ") || "—"}  /  ${c.relatedClasses.join(", ") || "—"}`, W - M * 2);
    if (c.ai) {
      y = field(M, y, "Resumen del agente", c.ai.summary, W - M * 2);
      y = field(M, y, "Razonamiento guardado", c.ai.reasoning, W - M * 2);
    }
    // pie
    doc.setFontSize(F.label); doc.setTextColor(...MUT);
    doc.text("vsion · texto de IA reproducido sin modificar · requiere revisión profesional antes de actuar", M, H - 8);
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
