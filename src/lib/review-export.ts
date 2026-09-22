import type { AiVerdict, PubDTO, ReportDTO } from "./dto";

const verdicts: Record<AiVerdict, string> = {
  file_opposition: "Oponerse", monitor_closely: "Vigilar", no_action: "Sin acción",
};

/** Mantiene separados los avisos, las coincidencias internas y los terceros. */
export function reportGroups(groups: PubDTO[], relation: "firm" | "own" | "conflict") {
  return groups.map((g) => ({ ...g, candidates: g.candidates.filter((c) => c.relation === relation) }))
    .filter((g) => g.candidates.length > 0);
}

export async function createSectionPdf(groups: PubDTO[], meta: ReportDTO["meta"], section: "firm" | "own") {
  const selected = reportGroups(groups, section);
  if (!selected.length) throw new Error("No hay registros para este reporte.");
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", format: "a4" });
  const title = section === "firm" ? "Tu firma | Conflictos internos del portafolio" : "Aviso de publicación";
  doc.setProperties({ title, subject: `Gaceta ${meta.country}${meta.number}`, creator: "vsion" });
  doc.setFontSize(17);
  doc.text(`vsion | ${title}`, 14, 17);
  doc.setFontSize(10);
  doc.text(`Gaceta ${meta.country}${meta.number} | Publicación: ${meta.datePublic}`, 14, 25);
  const publications = [...new Map(selected.map((g) => [g.applicationNumber || g.denom, g])).values()];
  const pairs = selected.flatMap((g) => g.candidates.map((c) => ({ g, c })));
  const description = section === "firm"
    ? `${pairs.length} coincidencias para revisión interna entre marcas representadas por tu firma. Posibles conflictos dentro del portafolio de la organización.`
    : `${publications.length} marcas propias publicadas. Aviso informativo de publicación en gaceta.`;
  doc.text(doc.splitTextToSize(description, 269), 14, 33);
  autoTable(doc, {
    startY: 46, margin: { top: 14, bottom: 18, left: 14, right: 14 },
    head: section === "firm"
      ? [["Marca publicada / expediente", "Solicitante / apoderado", "Marca del portafolio / código", "Titular / apoderado", "Clases pub. / cartera", "Similitud"]]
      : [["Marca publicada", "Expediente", "Titular / solicitante", "Apoderado", "Tipo de marca", "Clases Niza"]],
    body: section === "firm"
      ? pairs.map(({ g, c }) => [
          `${g.denom}\n${g.applicationNumber}`, `${g.applicant}\n${g.representant}`,
          `${c.clientDenom}\n${c.clientCode}`, `${c.clientHolder}\n${c.clientAttorney}`,
          `${g.classes.join(", ") || "-"} / ${c.clientClasses.join(", ") || "-"}`, `${c.score} / 100`,
        ])
      : publications.map((g) => [g.denom, g.applicationNumber, g.applicant, g.representant, g.markType, g.classes.join(", ") || "-"]),
    styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: section === "firm" ? [109, 76, 181] : [37, 99, 180] },
    rowPageBreak: "avoid",
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.text(`vsion | ${section === "firm" ? "Tu firma - Revisión interna" : "Aviso de publicación"} | Página ${doc.getNumberOfPages()}`, 14, 202);
    },
  });
  return doc.output("blob");
}

/** Filas para el Excel de sección (firm = pares publicación×portafolio; own = publicaciones únicas). */
export function sectionExportRows(groups: PubDTO[], section: "firm" | "own") {
  const selected = reportGroups(groups, section);
  if (section === "firm") {
    return selected.flatMap((g) => g.candidates.map((c) => ({
      "Marca publicada": g.denom,
      "Expediente publicación": g.applicationNumber,
      "Solicitante": g.applicant,
      "Apoderado publicación": g.representant,
      "Clases publicación": g.classes.join(", "),
      "Productos/servicios publicación": g.pys,
      "Marca del portafolio": c.clientDenom,
      "Código": c.clientCode,
      "Titular": c.clientHolder,
      "Apoderado portafolio": c.clientAttorney,
      "Clases portafolio": c.clientClasses.join(", "),
      "Productos/servicios portafolio": c.clientPys,
      "Similitud": c.score,
    })));
  }
  const pubs = [...new Map(selected.map((g) => [g.applicationNumber || g.denom, g])).values()];
  return pubs.map((g) => ({
    "Marca publicada": g.denom,
    "Expediente": g.applicationNumber,
    "Titular / solicitante": g.applicant,
    "Apoderado": g.representant,
    "Tipo de marca": g.markType,
    "Clases Niza": g.classes.join(", "),
    "Productos/servicios": g.pys,
  }));
}

export async function createSectionExcel(groups: PubDTO[], meta: ReportDTO["meta"], section: "firm" | "own") {
  const rows = sectionExportRows(groups, section);
  if (!rows.length) throw new Error("No hay registros para este reporte.");
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  // Anchos: descripciones anchas, resto según el largo del encabezado.
  sheet["!cols"] = Object.keys(rows[0]).map((k) => ({ wch: /Productos\/servicios/.test(k) ? 60 : Math.min(34, Math.max(14, k.length + 4)) }));
  if (sheet["!ref"]) sheet["!autofilter"] = { ref: sheet["!ref"] };
  const name = section === "firm" ? "Tu firma" : "Aviso publicación";
  XLSX.utils.book_append_sheet(workbook, sheet, name);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["Gaceta", `${meta.country}${meta.number}`],
    ["Publicación", meta.datePublic], ["Oposición hasta", meta.dateDue],
    ["Reporte", name], ["Registros", rows.length],
  ]), "Gaceta");
  return new Blob([XLSX.write(workbook, { type: "array", bookType: "xlsx" })], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function approvedExportRows(groups: PubDTO[]) {
  return reportGroups(groups, "conflict").flatMap((g) => g.candidates.map((c) => ({
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
    headStyles: { fillColor: [139, 125, 232] },
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

const normImg = (s: string) => (s || "").replace(/\.(webp|png|jpe?g)$/i, "");

/** Descarga una imagen y la convierte a JPEG dataURL (jsPDF no lee webp fiable). */
async function urlToJpeg(url: string, max = 320): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bmp = await createImageBitmap(await res.blob());
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    return { dataUrl: canvas.toDataURL("image/jpeg", 0.85), w, h };
  } catch { return null; }
}

/** Reporte profesional: portada + tabla consolidada + una ficha por caso. */
export async function createFichasPdf(groups: PubDTO[], meta: ReportDTO["meta"], images: Record<string, string> = {}, clientImages: Record<string, string> = {}) {
  groups = reportGroups(groups, "conflict");
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const items = groups.flatMap((g) => g.candidates.map((c) => ({ g, c })));

  // Prefetch de imágenes de publicación (una vez por id) → JPEG dataURL.
  const pics = new Map<string, { dataUrl: string; w: number; h: number }>();
  const wanted = new Map<string, string>();
  for (const g of groups) { const u = images[normImg(g.image)]; if (u) wanted.set(normImg(g.image), u); }
  await Promise.all([...wanted].map(async ([k, u]) => { const d = await urlToJpeg(u); if (d) pics.set(k, d); }));

  // Prefetch de imágenes de la marca del cliente (una vez por código) → JPEG dataURL.
  const cpics = new Map<string, { dataUrl: string; w: number; h: number }>();
  const wantedC = new Map<string, string>();
  for (const { c } of items) { const u = clientImages[c.clientCode]; if (u) wantedC.set(c.clientCode, u); }
  await Promise.all([...wantedC].map(async ([k, u]) => { const d = await urlToJpeg(u); if (d) cpics.set(k, d); }));
  const nOpp = items.filter((x) => x.c.ai?.recommendation === "file_opposition").length;
  const nMon = items.filter((x) => x.c.ai?.recommendation === "monitor_closely").length;

  const doc = new jsPDF({ orientation: "portrait", format: "a4" });
  const W = 210, H = 297, M = 14, colW = (W - M * 2 - 8) / 2;
  const ACC: [number, number, number] = [139, 125, 232];
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

    // Imagen de la publicación (si existe)
    const pim = pics.get(normImg(g.image));
    if (pim) {
      const boxW = 42, ih = Math.min(32, boxW * pim.h / pim.w);
      try { doc.addImage(pim.dataUrl, "JPEG", xL, yL, boxW, ih); } catch { /* omite si falla */ }
      yL += ih + 3;
    }
    // Imagen de la marca del cliente (si existe)
    const cim = cpics.get(c.clientCode);
    if (cim) {
      const boxW = 42, ih = Math.min(32, boxW * cim.h / cim.w);
      try { doc.addImage(cim.dataUrl, "JPEG", xR, yR, boxW, ih); } catch { /* omite si falla */ }
      yR += ih + 3;
    }

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
