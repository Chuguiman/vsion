/**
 * Etapa 1 — Barrido fonético/textual rapidísimo, en memoria, sin IA.
 * Índice invertido por trigramas + soundex para no comparar N×M completo.
 */
import { jaroWinkler, levenshteinRatio, diceCoefficient, wordContainment } from "./similarity";
import { classOverlap } from "./classes";
import { sameEntity } from "./owner";
import type { ClientMark, GazetteEntry, Candidate } from "./types";

export interface SweepOptions {
  threshold: number;      // score mínimo para conservar (0..100)
  topN: number;           // máx candidatos por publicación
  minSharedTrigrams: number;
  minDenomLen: number;    // long. mínima (alfanumérica) para comparar — filtra marcas de 1-2 letras
}

export const DEFAULT_SWEEP: SweepOptions = { threshold: 55, topN: 15, minSharedTrigrams: 2, minDenomLen: 3 };

// Palabras vacías / genéricas que no cuentan como "palabra distintiva compartida".
const STOPWORDS = new Set([
  "de", "del", "la", "las", "el", "los", "y", "e", "o", "en", "con", "por", "para", "al", "un", "una",
  "the", "of", "and", "for", "by", "to", "in", "on", "with",
  "sas", "ltda", "group", "grupo", "company", "compania", "internacional", "international",
  // laudatorias / genéricas frecuentes
  "nuevo", "nueva", "mejor", "calidad", "siempre", "futuro", "premium", "plus", "colombia",
]);
const MIN_WORD_LEN = 4;
// Una palabra es "rara" si aparece en ≤ RARE_WORD_MAX_DF publicaciones de la gaceta
// y en ≤ max(RARE_CARTERA_MIN, RARE_CARTERA_RATIO × marcas) marcas de la cartera.
const RARE_WORD_MAX_DF = 3;
const RARE_CARTERA_MIN = 10;
const RARE_CARTERA_RATIO = 0.002;
// Score mínimo cuando comparten una palabra distintiva y una clase (≥ threshold para conservarlo).
const SHARED_WORD_FLOOR = 0.60;

function wordsOf(words: string): string[] {
  return words.split(" ").filter((w) => w.length >= MIN_WORD_LEN && !STOPWORDS.has(w));
}

function docFreq(items: { keys: { words: string } }[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const it of items) for (const w of new Set(wordsOf(it.keys.words))) df.set(w, (df.get(w) ?? 0) + 1);
  return df;
}

/** Predicado "¿es rara?" según la frecuencia en la gaceta y en la cartera. */
function rareWordPredicate(gazette: GazetteEntry[], marks: ClientMark[]): (w: string) => boolean {
  const dfG = docFreq(gazette), dfC = docFreq(marks);
  const maxC = Math.max(RARE_CARTERA_MIN, Math.floor(marks.length * RARE_CARTERA_RATIO));
  return (w) => (dfG.get(w) ?? 0) <= RARE_WORD_MAX_DF && (dfC.get(w) ?? 0) <= maxC;
}

/** Score 0..100 entre una publicación y una marca del cliente.
 *  @param isRare si se pasa (y comparten clase), una palabra distintiva y rara
 *  compartida sube el score a SHARED_WORD_FLOOR. */
export function scorePair(g: GazetteEntry, c: ClientMark, isRare?: (w: string) => boolean): { score: number; breakdown: Record<string, number> } {
  const gk = g.keys, ck = c.keys;

  const jw = jaroWinkler(gk.clean, ck.clean);
  const lev = levenshteinRatio(gk.clean, ck.clean);
  const dice = diceCoefficient(gk.trigrams, ck.trigrams);

  // Bonus fonéticos (igualdad de clave)
  let phon = 0;
  if (gk.soundex && gk.soundex === ck.soundex) phon += 0.10;
  if (gk.metaphone && gk.metaphone === ck.metaphone) phon += 0.08;
  if (gk.spanish && gk.spanish === ck.spanish) phon += 0.12;
  if (gk.traps && gk.traps === ck.traps) phon += 0.10;

  let base = 0.34 * jw + 0.22 * lev + 0.24 * dice + phon;

  // Contención (una marca dentro de la otra) — riesgo alto aunque difieran en longitud
  const contained = wordContainment(gk.clean, gk.words, ck.clean, ck.words);
  if (contained) base = Math.max(base, 0.80);

  // Palabra distintiva compartida (p.ej. MARATÓN en "MEDIA MARATÓN DEL MILAGROSO" vs
  // "MARATÓN DE MEDELLIN"): el score global puede quedar bajo por la diferencia de largo.
  let sharedWord = false;
  if (isRare && g.classes.some((x) => c.classes.includes(x))) {
    const cw = new Set(wordsOf(ck.words));
    sharedWord = wordsOf(gk.words).some((w) => cw.has(w) && isRare(w));
    if (sharedWord) base = Math.max(base, SHARED_WORD_FLOOR);
  }

  const score = Math.round(Math.min(1, base) * 100);
  return {
    score,
    breakdown: {
      jaroWinkler: Math.round(jw * 100),
      levenshtein: Math.round(lev * 100),
      dice: Math.round(dice * 100),
      phonetic: Math.round(phon * 100),
      contained: contained ? 1 : 0,
      sharedWord: sharedWord ? 1 : 0,
    },
  };
}

/** Índice invertido de las marcas del cliente */
function buildIndex(marks: ClientMark[], minLen: number) {
  const byTrigram = new Map<string, number[]>();
  const bySoundex = new Map<string, number[]>();
  marks.forEach((m, i) => {
    if (m.keys.clean.length < minLen) return; // omite marcas de 1-2 letras
    for (const g of m.keys.trigrams) {
      let arr = byTrigram.get(g); if (!arr) { arr = []; byTrigram.set(g, arr); } arr.push(i);
    }
    if (m.keys.soundex) {
      let arr = bySoundex.get(m.keys.soundex); if (!arr) { arr = []; bySoundex.set(m.keys.soundex, arr); } arr.push(i);
    }
  });
  return { byTrigram, bySoundex };
}

export interface SweepResult {
  candidates: Candidate[];
  stats: { pairsScored: number; kept: number; elapsedMs: number };
}

export function sweep(gazette: GazetteEntry[], marks: ClientMark[], opts: SweepOptions = DEFAULT_SWEEP): SweepResult {
  const t0 = Date.now();
  const { byTrigram, bySoundex } = buildIndex(marks, opts.minDenomLen);
  const isRare = rareWordPredicate(gazette, marks);
  const candidates: Candidate[] = [];
  let pairsScored = 0;

  for (const g of gazette) {
    if (g.keys.clean.length < opts.minDenomLen) continue; // omite gaceta de 1-2 letras
    // Reunir candidatos: comparten soundex o >= minSharedTrigrams trigramas
    const counts = new Map<number, number>();
    for (const tri of g.keys.trigrams) {
      const arr = byTrigram.get(tri);
      if (arr) for (const idx of arr) counts.set(idx, (counts.get(idx) ?? 0) + 1);
    }
    const candIdx = new Set<number>();
    for (const [idx, n] of counts) if (n >= opts.minSharedTrigrams) candIdx.add(idx);
    if (g.keys.soundex) for (const idx of bySoundex.get(g.keys.soundex) ?? []) candIdx.add(idx);

    const scored: Candidate[] = [];
    for (const idx of candIdx) {
      const c = marks[idx];
      pairsScored++;
      const { score, breakdown } = scorePair(g, c, isRare);
      if (score < opts.threshold) continue;
      const { matching, related } = classOverlap(g.classes, c.classes);
      const sameOwner = sameEntity(g.applicant, c.holder);
      const sameAttorney = sameEntity(g.representant, c.attorney);
      scored.push({ gazette: g, client: c, score, breakdown, matchingClasses: matching, relatedClasses: related, sameOwner, sameAttorney });
    }

    scored.sort((a, b) => b.score - a.score);
    for (const cand of scored.slice(0, opts.topN)) candidates.push(cand);
  }

  candidates.sort((a, b) => b.score - a.score);
  return {
    candidates,
    stats: { pairsScored, kept: candidates.length, elapsedMs: Date.now() - t0 },
  };
}
