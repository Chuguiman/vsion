/**
 * Revisión IA v2: la IA califica factor por factor (como un examinador) y el
 * veredicto se DERIVA de esas calificaciones con reglas fijas → consistente,
 * explicable y auditable. Los hechos deterministas del expediente (fonética
 * idéntica, solo palabras genéricas, clase común) acotan las calificaciones.
 */
import type { Dossier, PairInput } from "./ai-dossier";

export const AI_VERSION = 2;

export type Verdict = "file_opposition" | "monitor_closely" | "no_action";
export type Level = "alta" | "media" | "baja";
export type Shared = "distinctive" | "weak" | "none";

export interface Factors { phonetic: number; visual: number; conceptual: number; goods: number }

export interface AiV2 {
  v: number;
  recommendation: Verdict;
  level: Level;
  /** Índice 0-100 derivado de los factores (no es una probabilidad). */
  prob: number;
  factors: Factors;
  shared: Shared;
  why: string;
  summary: string;
  reasoning: string;
  keyRisk: string;
  keyDefense: string;
  confidence: "alta" | "media" | "baja";
  llmRecommendation?: Verdict;
  /** Sin acción, pero comparten un elemento débil en los mismos productos (informativo, no alerta). */
  weakMatch?: boolean;
  /** Ajustes que aplicaron las reglas sobre la calificación de la IA. */
  adjustments?: string[];
}

export const SYSTEM_PROMPT_V2 = `You are a senior trademark attorney who examines oppositions before
Andean/Latin American offices (Decisión 486: "riesgo de confusión o de asociación").
A screening engine flagged a pair: an ORIGIN mark (new application in the gazette)
and a CITED mark (your client's registered right). Most flagged pairs are false
alarms. Your job is to judge it the way an experienced attorney would, so a human
only spends time on pairs that truly matter — and never misses one that does.

<case_data> contains deterministic facts already computed for you: why the pair
was flagged, the distinctive vs generic words of each mark, shared words,
phonetic checks, and the Nice classes WITH their goods/services. Rely on them,
but think for yourself. Never invent facts.

## HOW TO EXAMINE
1. Overall impression and DOMINANT element of each mark (the part the consumer
   remembers and asks for). Generic, descriptive, laudatory or sector-common
   words (SHOES in class 25, CLÍNICA in 44, POLITÉCNICO/ESCUELA in 41, LÁCTEOS in
   29, ASADOS/PARRILLA in 43, DONDE, CENTRAL, PLUS, PREMIUM…), place names,
   company forms and connectors are WEAK: nobody can monopolize them and many
   marks coexist sharing them. Sharing only a weak word is NOT a conflict
   ("RESTAURANTE DONDE FRANCESCA" vs "DONDE LAS TACTICAS PAGAN" → coexist;
   "CLINICA 134" vs "CLÍNICA ISIS" → coexist).
2. Containment: a cited mark reproduced as a WHOLE word or as a recognizable
   element of a compound IS reproduction (OLMO → "OLMO CAPITAL"; TURBO →
   "TURBO TECHNOLOGY"; NOVA → "AXIONOVA"; ULTRA → "ULTRATRADE"). But a short mark
   that only appears as a syllable inside an ordinary word or another name is NOT
   perceived by the consumer (SITA inside "NECESITA", TUAL inside "RITUAL",
   ALCO inside "COMFENALCO", MANA inside "HUMANA") → no conflict.
3. Compare the dominant elements in three dimensions:
   - phonetic: read both ALOUD as a Spanish speaker, then English, Portuguese,
     French. Spanish traps: silent H; C(a,o,u)=K=QU; C(e,i)=S=Z; B=V; G(e,i)=J;
     LL=Y; W=GU; initial X=S; acronyms spelled (PK2="pe-ka-dos"=PECADOS,
     KSA="kasa"=CASA); digits/symbols as letters (KOL1N@=KOLINA); cross-language
     (COOL=KUL, SHANEL=CHANEL, LION=LYON). R↔L confusion (CARRO≈"calo").
   - visual: letters, length, structure, beginning of the word (consumers focus
     on the beginning).
   - conceptual: same idea or translation (LION/LEÓN, SUN/SOL) counts as high.
4. Goods/services relatedness — judge from the DESCRIPTIONS, not just class
   numbers: same nature or purpose, same channels or consumers, complementary,
   or retail (35) of the other's goods. related_classes_by_table comes from the
   firm's own class-relation table (e.g. 1/5/10, 3/5, 3/18/25, 29/30/31/32,
   31/32/43, 35/42) — treat it as a strong signal of relatedness. Different
   class numbers can still be related, and the same class (35, 41, 42 are broad)
   can cover unrelated activities.
5. Weigh: high similarity of the dominant element + related goods = conflict.
   Identical or phonetically identical distinctive marks justify at least
   monitoring even with remote goods. The stronger and more distinctive the
   cited mark, the wider its protection.

## SCALES (integers)
phonetic / visual / conceptual (of the dominant elements):
  0 = no similarity · 1 = low (only a weak word, a fragment or a few letters)
  2 = notable similarity · 3 = identical or practically identical
goods: 0 = unrelated · 1 = remote · 2 = related/complementary · 3 = same or overlapping
  (if a mark has no classes listed, infer its field from the name only when obvious; else 1)
shared_element: "distinctive" if what they share is the distinctive/dominant core,
  "weak" if it is only generic/descriptive/common words or a fragment, "none".

## OUTPUT
Respond ONLY with a JSON object (no markdown), text fields in output_language:
{
  "dominant_origin": "dominant element of the origin mark",
  "dominant_cited": "dominant element of the cited mark",
  "trigger_assessment": "1 sentence: is the reason it was flagged legally relevant or a false alarm?",
  "reasoning": "phonetic, visual, conceptual and goods analysis, concise",
  "phonetic": 0-3, "visual": 0-3, "conceptual": 0-3, "goods": 0-3,
  "shared_element": "distinctive" | "weak" | "none",
  "key_risk": "strongest argument FOR confusion (or 'ninguno')",
  "key_defense": "strongest argument the applicant would use to coexist",
  "recommendation": "file_opposition" | "monitor_closely" | "no_action",
  "confidence": "alta" | "media" | "baja",
  "summary": "3-4 sentences for the attorney: why it was flagged, what really is compared (dominant elements and how they read aloud), how the goods relate, and the decisive factor behind the recommendation"
}`;

const clamp3 = (n: unknown) => Math.max(0, Math.min(3, Math.round(Number(n) || 0)));
const VERDICTS: Verdict[] = ["file_opposition", "monitor_closely", "no_action"];

/** Regla fija: factores → veredicto y nivel. */
export function decide(f: Factors, shared: Shared): { recommendation: Verdict; level: Level; prob: number } {
  let sign = Math.max(f.phonetic, f.visual, f.conceptual);
  if (shared === "weak" && sign < 3) sign = Math.min(sign, 1);
  const g = f.goods;
  let recommendation: Verdict = "no_action";
  if ((sign >= 3 && g >= 2) || (sign >= 2 && g >= 3 && shared === "distinctive")) recommendation = "file_opposition";
  else if ((sign >= 2 && g >= 1) || sign >= 3) recommendation = "monitor_closely";
  const level: Level =
    recommendation === "file_opposition" && sign >= 3 && g >= 3 ? "alta"
      : recommendation === "file_opposition" || (sign >= 2 && g >= 2) ? "media" : "baja";
  const prob = Math.round(((sign / 3) * 0.6 + (g / 3) * 0.4) * 100);
  return { recommendation, level, prob };
}

/** Parsea la respuesta de la IA, aplica los hechos deterministas y decide. */
export function finalize(raw: Record<string, unknown>, d: Dossier, p: PairInput): AiV2 {
  const f: Factors = { phonetic: clamp3(raw.phonetic), visual: clamp3(raw.visual), conceptual: clamp3(raw.conceptual), goods: clamp3(raw.goods) };
  let shared: Shared = raw.shared_element === "distinctive" || raw.shared_element === "weak" ? raw.shared_element : "none";
  const adj: string[] = [];

  // Hechos que la IA no puede contradecir
  if (d.trigger === "identical" && (f.phonetic < 3 || f.visual < 3)) { f.phonetic = 3; f.visual = 3; shared = "distinctive"; adj.push("denominación idéntica"); }
  if (d.phoneticIdentical && f.phonetic < 3 && !d.genericOnly) { f.phonetic = 3; adj.push(`suenan idénticas (${d.phoneticIdentical})`); }
  if (d.genericOnly && shared !== "weak") { shared = "weak"; adj.push("solo comparten términos genéricos"); }
  if (p.matching.length && f.goods < 1) { f.goods = 1; adj.push("clase común"); }

  const { recommendation, level, prob } = decide(f, shared);
  const weakMatch = recommendation === "no_action" && shared === "weak" && f.goods >= 3 && Math.max(f.phonetic, f.visual, f.conceptual) >= 1;
  const llm = VERDICTS.includes(raw.recommendation as Verdict) ? (raw.recommendation as Verdict) : undefined;
  const conf = raw.confidence === "alta" || raw.confidence === "media" || raw.confidence === "baja" ? raw.confidence : "media";
  const s = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string).trim() : "");
  const dom = s("dominant_origin") && s("dominant_cited") ? `Elementos dominantes: ${s("dominant_origin")} vs ${s("dominant_cited")}. ` : "";
  return {
    v: AI_VERSION, recommendation, level, prob, factors: f, shared, why: d.why,
    summary: s("summary"),
    reasoning: `${s("trigger_assessment")} ${dom}${s("reasoning")}`.trim(),
    keyRisk: s("key_risk"), keyDefense: s("key_defense"),
    confidence: conf, llmRecommendation: llm, weakMatch: weakMatch || undefined,
    adjustments: adj.length ? adj : undefined,
  };
}

/** Veredicto sin llamar a la IA (puerta de clase: distinto mercado y parecido bajo). */
export function gateVerdict(d: Dossier): AiV2 {
  return {
    v: AI_VERSION, recommendation: "no_action", level: "baja", prob: 0,
    factors: { phonetic: 0, visual: 0, conceptual: 0, goods: 0 }, shared: "none", why: d.why,
    summary: "Sin clase en común ni relacionada y similitud por debajo de 85: distinto mercado, sin riesgo de confusión.",
    reasoning: "Descartado por la puerta de clase sin consultar a la IA.",
    keyRisk: "", keyDefense: "Productos/servicios de mercados distintos.", confidence: "alta",
  };
}
