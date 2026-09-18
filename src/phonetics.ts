/**
 * Motor fonético — portado de samai-next/src/lib/expression-indexer.ts
 * Solo las funciones que necesita el barrido. TypeScript puro, sin dependencias.
 */

/** Quita diacríticos */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/** normaliza → minúsculas → solo alfanumérico → sin espacios */
export function cleanText(text: string): string {
  return normalize(text).toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "");
}

/** normaliza conservando espacios (para comparación textual visible) */
export function normWords(text: string): string {
  return normalize(text).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function soundex(text: string): string | null {
  const clean = cleanText(text);
  if (!clean) return null;
  const map: Record<string, string> = {
    B: "1", F: "1", P: "1", V: "1",
    C: "2", G: "2", J: "2", K: "2", Q: "2", S: "2", X: "2", Z: "2",
    D: "3", T: "3", L: "4", M: "5", N: "5", R: "6",
  };
  const upper = clean.toUpperCase();
  let result = upper[0];
  let prev = map[upper[0]] ?? "0";
  for (let i = 1; i < upper.length; i++) {
    const code = map[upper[i]] ?? "0";
    if (code !== "0" && code !== prev) result += code;
    prev = code;
  }
  return (result + "0000").slice(0, 4);
}

export function metaphone(text: string): string | null {
  const clean = cleanText(text);
  if (!clean) return null;
  let s = clean.toUpperCase();
  if (/^(AE|GN|KN|PN|WR)/.test(s)) s = s.slice(1);
  let result = "";
  let i = 0;
  while (i < s.length && result.length < 20) {
    const c = s[i];
    const next = s[i + 1] ?? "";
    const prev = s[i - 1] ?? "";
    if (c === prev && c !== "C") { i++; continue; }
    if ("AEIOU".includes(c)) { if (i === 0) result += c; i++; continue; }
    switch (c) {
      case "B": if (prev !== "M") result += "B"; break;
      case "C": result += (next === "I" || next === "E" || next === "Y") ? "S" : "K"; break;
      case "D": result += (next === "G" && "IEY".includes(s[i + 2] ?? "")) ? "J" : "T"; break;
      case "F": result += "F"; break;
      case "G":
        if (next === "H" && !"AEIOU".includes(s[i + 2] ?? "")) { i++; break; }
        if (i > 0 && next === "N") break;
        result += "IEY".includes(next) ? "J" : "K"; break;
      case "H": if ("AEIOU".includes(next) && !"AEIOU".includes(prev)) result += "H"; break;
      case "J": result += "J"; break;
      case "K": if (prev !== "C") result += "K"; break;
      case "L": result += "L"; break;
      case "M": result += "M"; break;
      case "N": result += "N"; break;
      case "P": if (next === "H") { result += "F"; i++; } else result += "P"; break;
      case "Q": result += "K"; break;
      case "R": result += "R"; break;
      case "S":
        if (next === "H" || (next === "I" && (s[i + 2] === "O" || s[i + 2] === "A"))) { result += "X"; i++; }
        else result += "S"; break;
      case "T":
        if (next === "H") { result += "0"; i++; }
        else if (next === "I" && (s[i + 2] === "O" || s[i + 2] === "A")) result += "X";
        else result += "T"; break;
      case "V": result += "F"; break;
      case "W": case "Y": if ("AEIOU".includes(next)) result += c; break;
      case "X": result += "KS"; break;
      case "Z": result += "S"; break;
    }
    i++;
  }
  return result || null;
}

/** Fonética española (ll→y, c/z→s, v→b, h→∅, j/g→x, ...) */
export function spanishPhonetic(text: string): string | null {
  const rules: [RegExp, string][] = [
    [/ll/g, "y"], [/ch/g, "x"], [/ñ/g, "ny"], [/qu/g, "k"],
    [/c([ei])/g, "s$1"], [/z/g, "s"], [/v/g, "b"], [/h/g, ""],
    [/j/g, "x"], [/g([ei])/g, "x$1"], [/rr/g, "r"], [/y([aeiou])/g, "i$1"],
  ];
  let t = normalize(text).toLowerCase();
  for (const [p, r] of rules) t = t.replace(p, r);
  return t.replace(/[^a-z0-9]/g, "") || null;
}

/** Trampas fonéticas: KOL1N@ → kolina, sustituye dígitos/símbolos por letras */
export function phoneticTraps(expression: string): string {
  let result = normalize(expression);
  for (const c of ["-", "_", "*", "/", "<", ">", ".", "'", "|", "~", "=", ":", ";"]) result = result.split(c).join("");
  const numberExpansions: [string, string][] = [
    ["1000", "MIL"], ["100", "CIEN"], ["90", "NOVENTA"], ["80", "OCHENTA"],
    ["70", "SETENTA"], ["60", "SESENTA"], ["50", "CINCUENTA"],
    ["40", "CUARENTA"], ["30", "TREINTA"], ["20", "VEINTE"], ["10", "DIEZ"],
  ];
  for (const [num, word] of numberExpansions) result = result.split(num).join(word);
  const numSubs: Record<string, string> = { "0": "O", "1": "I", "2": "Z", "3": "E", "4": "A", "5": "S", "6": "G", "7": "T", "8": "B", "9": "G" };
  for (const [d, l] of Object.entries(numSubs)) result = result.split(d).join(l);
  const symSubs: Record<string, string> = { "@": "A", "$": "S", "+": "T", "!": "I", "€": "E", "&": "Y", "%": "O", "*": "X", "#": "H" };
  for (const [sy, l] of Object.entries(symSubs)) result = result.split(sy).join(l);
  return result.toLowerCase().replace(/\s+/g, "");
}

/** N-gramas (set de subcadenas de longitud n) */
export function nGramSet(text: string, n: number): Set<string> {
  const clean = cleanText(text);
  const set = new Set<string>();
  if (clean.length < n) { if (clean) set.add(clean); return set; }
  for (let i = 0; i <= clean.length - n; i++) set.add(clean.slice(i, i + n));
  return set;
}

/** Claves fonéticas pre-calculadas de una expresión (para el barrido) */
export interface PhoneticKeys {
  clean: string;
  words: string;
  soundex: string | null;
  metaphone: string | null;
  spanish: string | null;
  traps: string;
  trigrams: Set<string>;
}

export function computeKeys(expression: string): PhoneticKeys {
  return {
    clean: cleanText(expression),
    words: normWords(expression),
    soundex: soundex(expression),
    metaphone: metaphone(expression),
    spanish: spanishPhonetic(expression),
    traps: phoneticTraps(expression),
    trigrams: nGramSet(expression, 3),
  };
}
