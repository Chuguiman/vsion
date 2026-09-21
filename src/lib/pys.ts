// Extrae la descripción por clase del texto de productos/servicios (pys).
// Formato típico del SIC / carteras: "29. carne, pescado…; 35. publicidad…"
// (el número de clase, un punto y la descripción hasta la siguiente clase).
//
// Para evitar cortes falsos (las descripciones tienen puntos y números), solo
// se usan como separadores los números que SÍ son clases del signo, ubicados al
// inicio del texto o tras un punto / punto y coma.
export function pysByClass(pys: string, classes: number[]): Record<number, string> {
  const out: Record<number, string> = {};
  if (!pys || !classes.length) return out;
  const set = new Set(classes);
  const re = /(^|[.;]\s*)(\d{1,2})\.\s/g;
  const marks: { cls: number; numStart: number; textStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(pys)) !== null) {
    const cls = Number(m[2]);
    if (!set.has(cls)) continue;
    marks.push({ cls, numStart: m.index + m[1].length, textStart: re.lastIndex });
  }
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1].numStart : pys.length;
    const text = pys.slice(marks[i].textStart, end).trim().replace(/[;,.\s]+$/, "");
    if (text && out[marks[i].cls] === undefined) out[marks[i].cls] = text;
  }
  return out;
}
