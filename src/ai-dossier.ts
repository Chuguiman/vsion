/**
 * Expediente determinista de un par (publicación vs marca del cliente) que se le
 * entrega a la IA y se muestra al revisor: POR QUÉ el barrido lo marcó, cuál es
 * la parte distintiva de cada marca, qué comparten (y si es genérico o está
 * diluido) y qué dice la fonética. Así la IA razona sobre hechos verificables en
 * vez de adivinar desde un score.
 */
import { normWords, cleanText } from "./phonetics";
import { GENERIC_WORDS, distinctiveWords, genericOnlyOverlap } from "./generic-words";
import { jaroWinkler, levenshteinRatio } from "./similarity";
import { phoneticallyIdentical, phoneticConfusion, sharedReading, LANG_LABEL } from "./phonetic-langs";
import { niceTitle } from "./classes";

export interface PairInput {
  pubDenom: string; pubClasses: number[]; pubPys: string;
  clientDenom: string; clientClasses: number[]; clientPys: string;
  matching: number[]; related: number[]; score: number;
}

export type TriggerKind = "identical" | "phonetic" | "confusion" | "contained_word" | "contained_fragment" | "shared_word" | "textual";

export interface Dossier {
  /** Motivo principal por el que el par llegó a revisión. */
  trigger: TriggerKind;
  /** Explicación legible del motivo (para la IA y para el revisor). */
  why: string;
  coresPub: string[];
  coresClient: string[];
  sharedDistinctive: string[];
  sharedGeneric: string[];
  /** Solo comparten términos genéricos y lo distintivo difiere. */
  genericOnly: boolean;
  phoneticIdentical: string | null;
  phoneticConfusion: string | null;
  /** Parecido de los núcleos distintivos (0..100). */
  coreSimilarity: number;
  /** Cuántas marcas de la corrida contienen cada palabra compartida (dilución). */
  dilution: Record<string, number>;
}

const words = (s: string) => normWords(s).split(" ").filter(Boolean);

/** ¿La marca corta aparece en la larga como palabra completa o solo como trozo de una palabra? */
function containment(a: string, b: string): { kind: "word" | "fragment"; host?: string; short: string } | null {
  const ca = cleanText(a), cb = cleanText(b);
  if (ca.length < 3 || cb.length < 3 || ca === cb) return null;
  const [short, long] = ca.length <= cb.length ? [ca, b] : [cb, a];
  const ws = words(long);
  // palabra completa o secuencia de palabras completas (COCA COLA ⊂ COCA COLA ZERO)
  for (let i = 0; i < ws.length; i++) {
    let acc = "";
    for (let j = i; j < ws.length && acc.length < short.length; j++) {
      acc += ws[j];
      if (acc === short) return { kind: "word", short };
    }
  }
  if (short.length < 4) return null;
  for (const w of ws) {
    if (w !== short && (w.startsWith(short) || w.endsWith(short))) return { kind: "fragment", host: w, short };
  }
  return null;
}

export function buildDossier(p: PairInput, wordFreq?: (w: string) => number): Dossier {
  const wa = new Set(words(p.pubDenom)), wb = new Set(words(p.clientDenom));
  const shared = [...wa].filter((w) => wb.has(w) && w.length >= 2);
  const sharedGeneric = shared.filter((w) => GENERIC_WORDS.has(w));
  const sharedDistinctive = shared.filter((w) => !GENERIC_WORDS.has(w));
  const coresPub = distinctiveWords(p.pubDenom), coresClient = distinctiveWords(p.clientDenom);
  const ca = coresPub.join(""), cb = coresClient.join("");
  const coreSimilarity = ca && cb ? Math.round(Math.max(jaroWinkler(ca, cb) * 0.6 + levenshteinRatio(ca, cb) * 0.4, 0) * 100) : 0;

  const langs = phoneticallyIdentical(p.pubDenom, p.clientDenom);
  const reading = langs.length ? sharedReading(p.pubDenom, p.clientDenom) : null;
  const phon = langs.length ? `${langs.map((l) => LANG_LABEL[l]).join(", ")}${reading ? ` (lectura ${reading})` : ""}` : null;
  const conf = phon ? null : phoneticConfusion(p.pubDenom, p.clientDenom);
  const genericOnly = !phon && !!genericOnlyOverlap(p.pubDenom, p.clientDenom) && !sharedDistinctive.length;
  const dilution: Record<string, number> = {};
  if (wordFreq) for (const w of shared) dilution[w] = wordFreq(w);

  const A = p.pubDenom.trim(), B = p.clientDenom.trim();
  let trigger: TriggerKind, why: string;
  const cont = containment(A, B);
  if (cleanText(A) === cleanText(B)) {
    trigger = "identical"; why = `Denominación idéntica ("${A}" = "${B}").`;
  } else if (phon) {
    trigger = "phonetic"; why = `Suenan idénticas leídas en voz alta en ${phon}.`;
  } else if (cont?.kind === "word") {
    trigger = "contained_word"; why = `"${cont.short.toUpperCase()}" aparece como palabra completa dentro de la otra marca.`;
  } else if (sharedDistinctive.length) {
    const d = sharedDistinctive.map((w) => `${w.toUpperCase()}${dilution[w] ? ` (en ${dilution[w]} marcas de esta corrida)` : ""}`);
    trigger = "shared_word"; why = `Comparten la palabra ${d.join(", ")}; el resto de cada marca es ${coreSimilarity >= 75 ? "parecido" : "distinto"}.`;
  } else if (cont?.kind === "fragment") {
    trigger = "contained_fragment";
    why = `"${cont.short.toUpperCase()}" solo aparece como trozo de la palabra "${cont.host!.toUpperCase()}", no como palabra propia.`;
  } else if (conf) {
    trigger = "confusion"; why = `Posible confusión fonética: ${conf}.`;
  } else if (sharedGeneric.length) {
    trigger = "shared_word"; why = `Solo comparten términos genéricos (${sharedGeneric.map((w) => w.toUpperCase()).join(", ")}); núcleos distintivos ${coreSimilarity}% parecidos.`;
  } else {
    trigger = "textual"; why = `Parecido de escritura/sonido general (score ${p.score}); núcleos distintivos ${coreSimilarity}% parecidos.`;
  }
  return { trigger, why, coresPub, coresClient, sharedDistinctive, sharedGeneric, genericOnly, phoneticIdentical: phon, phoneticConfusion: conf, coreSimilarity, dilution };
}

/** Texto de clases con su título Niza y la descripción de productos/servicios. */
export function classesText(nums: number[], pys: string, max = 700): string {
  if (!nums.length) return "none";
  const t = nums.map((n) => `${n} (${niceTitle(n)})`).join("; ");
  return pys ? `${t} — productos/servicios: ${pys.slice(0, max)}` : t;
}

/** Bloque <case_data> para la IA. */
export function dossierPrompt(p: PairInput, d: Dossier, jurisdiction: string, lang: string): string {
  const list = (x: string[]) => (x.length ? x.map((w) => w.toUpperCase()).join(" ") : "(ninguna)");
  return [
    "<case_data>",
    `output_language: ${lang}`,
    `jurisdiction: ${jurisdiction}`,
    `origin_mark: ${p.pubDenom}`,
    `origin_classes: ${classesText(p.pubClasses, p.pubPys)}`,
    `cited_mark: ${p.clientDenom}`,
    `cited_classes: ${classesText(p.clientClasses, p.clientPys)}`,
    `classes_in_common: ${p.matching.join(", ") || "none"}`,
    `related_classes_by_table: ${p.related.join(", ") || "none"} (tabla interna; juzga tú la relación real de productos/servicios)`,
    `why_flagged: ${d.why}`,
    `distinctive_words_origin: ${list(d.coresPub)}`,
    `distinctive_words_cited: ${list(d.coresClient)}`,
    `shared_distinctive_words: ${list(d.sharedDistinctive)}`,
    `shared_generic_words: ${list(d.sharedGeneric)}`,
    `core_similarity: ${d.coreSimilarity}`,
    `phonetically_identical_in: ${d.phoneticIdentical ?? "none detected (still read both aloud yourself)"}`,
    `common_phonetic_confusion: ${d.phoneticConfusion ?? "none detected"}`,
    `sweep_score: ${p.score}`,
    "</case_data>",
  ].join("\n");
}
