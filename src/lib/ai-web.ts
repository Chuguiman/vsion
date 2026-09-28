import { getDb, withDbRetry } from "./db";
import { SYSTEM_PROMPT } from "@/ai-review";
import { phoneticallyIdentical, phoneticConfusion, sharedReading, LANG_LABEL } from "@/phonetic-langs";
import type { ReportDTO, CandDTO, PubDTO, AiResult, AiVerdict } from "./dto";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const JURISDICTION: Record<string, string> = {
  CO: "SIC Colombia", MX: "IMPI Mexico", ES: "OEPM Spain", US: "USPTO",
  PE: "INDECOPI Peru", CL: "INAPI Chile", EC: "SENADI Ecuador", BR: "INPI Brazil",
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function buildPrompt(cand: CandDTO, pub: PubDTO, jurisdiction: string, lang: string): string {
  const fmt = (nums: number[], pys: string) => (nums.length ? nums.join(", ") + (pys ? ` — ${pys}` : "") : "none");
  return [
    "<case_data>",
    `output_language: ${lang}`,
    `jurisdiction: ${jurisdiction}`,
    `origin_mark: ${pub.denom}`,
    `origin_classes: ${fmt(pub.classes, pub.pys)}`,
    `cited_mark: ${cand.clientDenom}`,
    `cited_classes: ${fmt(cand.clientClasses, cand.clientPys)}`,
    `classes_in_common: ${cand.matchingClasses.join(", ") || "none"}`,
    `related_classes: ${cand.relatedClasses.join(", ") || "none"}`,
    `similarity_score: ${cand.score}`,
    `phonetically_identical_in: ${phoneticNote(pub.denom, cand.clientDenom) ?? "none detected (still read both aloud yourself)"}`,
    `common_phonetic_confusion: ${phoneticConfusion(pub.denom, cand.clientDenom) ?? "none detected"}`,
    "</case_data>",
  ].join("\n");
}

async function callOne(cand: CandDTO, pub: PubDTO, apiKey: string, model: string, jur: string, lang: string, maxRetries = 3): Promise<AiResult> {
  const prompt = buildPrompt(cand, pub, jur, lang);
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1) + Math.random() * 400);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://vsion.local", "X-Title": "vsion" },
        body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }] }),
      });
      if (res.status === 429 || res.status >= 500) { lastErr = new Error(`OpenRouter ${res.status}`); continue; }
      if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 160)}`);
      const data = await res.json();
      const text: string = data.choices?.[0]?.message?.content ?? "";
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) { lastErr = new Error("Sin JSON"); continue; }
      const raw = JSON.parse(m[0]);
      const rec = (["file_opposition", "monitor_closely", "no_action"].includes(raw.recommendation) ? raw.recommendation : "no_action") as AiVerdict;
      return {
        recommendation: rec,
        prob: Math.max(0, Math.min(100, Math.round(raw.success_probability ?? 0))),
        summary: raw.summary ?? "",
        reasoning: raw.ai_reasoning ?? "",
      };
    } catch (err) { lastErr = err; }
  }
  throw lastErr ?? new Error("agotó reintentos");
}

/** "español, inglés (lectura "pekados")" o null si no suenan idénticas. */
function phoneticNote(a: string, b: string): string | null {
  const langs = phoneticallyIdentical(a, b);
  if (!langs.length) return null;
  const r = sharedReading(a, b);
  return `${langs.map((l) => LANG_LABEL[l]).join(", ")}${r ? ` (lectura ${r})` : ""}`;
}

/**
 * Regla dura sobre el veredicto de la IA: si suenan IDÉNTICAS leídas en voz alta
 * en español, inglés, portugués o francés (CONTÍ/KONTI, KSA/CASA, PK2/PECADOS,
 * BACA/VACA) → "Oponerse" con clase común/relacionada; sin clase, al menos "Vigilar".
 */
export function withSafetyNet(cand: CandDTO, pub: PubDTO, ai: AiResult): AiResult {
  const note = phoneticNote(pub.denom, cand.clientDenom);
  const classes = cand.matchingClasses.length > 0 || cand.relatedClasses.length > 0;
  if (!note) {
    // Nivel 2: confusión frecuente (CARRO/CALO, FREIJOA/FEIJOA) → al menos "Vigilar" con clase.
    const conf = phoneticConfusion(pub.denom, cand.clientDenom);
    if (!conf || !classes) return ai;
    const base = ai.summary.replace(/^Posible confusión fonética[^.]*\.\s*(IA:\s*)?/, "");
    const rec = ai.recommendation === "no_action" ? "monitor_closely" : ai.recommendation;
    return { ...ai, recommendation: rec, prob: rec === ai.recommendation ? ai.prob : Math.max(ai.prob, 40), summary: `Posible confusión fonética: ${conf}. IA: ${base}` };
  }
  const how = `Fonéticamente idéntica en ${note}`;
  const base = ai.summary.replace(/^Fonéticamente idéntica[^.]*\.\s*(IA:\s*)?/, ""); // idempotente
  if (classes && ai.recommendation !== "file_opposition") {
    return { ...ai, recommendation: "file_opposition", prob: Math.max(ai.prob, 70), summary: `${how}, con clase común o relacionada: posible oposición. IA: ${base}` };
  }
  if (!classes && ai.recommendation === "no_action") {
    return { ...ai, recommendation: "monitor_closely", prob: Math.max(ai.prob, 40), summary: `${how}, aunque sin clase común ni relacionada: revisar. IA: ${base}` };
  }
  // La IA ya coincidía: igual se deja la explicación fonética en el resumen.
  return { ...ai, summary: `${how}. ${base}` };
}

export interface BatchResult { ok: boolean; error?: string; analyzed: number; total: number; remaining: number; }

/** Analiza un lote de conflictos sin veredicto y persiste en el payload. */
export async function analyzeRunBatch(runId: number, batchSize = 15): Promise<BatchResult> {
  if (!getDb()) return { ok: false, error: "Sin base de datos.", analyzed: 0, total: 0, remaining: 0 };
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { ok: false, error: "Falta OPENROUTER_API_KEY en el entorno.", analyzed: 0, total: 0, remaining: 0 };
  const model = process.env.AI_MODEL ?? "deepseek/deepseek-chat";

  const [row] = await withDbRetry(() => getDb()!<{ payload: ReportDTO }[]>`SELECT payload FROM runs WHERE id = ${runId}`);
  if (!row) return { ok: false, error: "Corrida no encontrada.", analyzed: 0, total: 0, remaining: 0 };
  const dto = row.payload;
  const jur = JURISDICTION[dto.meta.country] ?? dto.meta.country;
  const lang = dto.meta.language || "es";

  // Reunir conflictos
  const conflicts: { cand: CandDTO; pub: PubDTO }[] = [];
  for (const pub of dto.groups) for (const cand of pub.candidates) if (cand.relation === "conflict") conflicts.push({ cand, pub });
  const total = conflicts.length;

  // Pre-filtro (puerta de clase): un conflicto SIN clase en común/relacionada y con
  // score < 85 es distinto mercado → la IA diría "no_action". Se resuelve sin llamada.
  const worthy = (c: CandDTO) => c.matchingClasses.length > 0 || c.relatedClasses.length > 0 || c.score >= 85;
  for (const { cand, pub } of conflicts) {
    if (!cand.ai && !worthy(cand)) {
      cand.ai = withSafetyNet(cand, pub, {
        recommendation: "no_action",
        prob: 0,
        summary: "Sin clase en común ni relacionada y similitud por debajo de 85%: distinto mercado, sin riesgo de confusión.",
        reasoning: "Descartado por la puerta de clase (sin coincidencia de clases y score bajo). No requiere revisión.",
      });
    }
  }

  // Solo se llaman los que valen la pena y aún no tienen veredicto
  const pending = conflicts.filter((x) => !x.cand.ai);
  const batch = pending.slice(0, batchSize);

  // Pool de concurrencia dentro del lote
  const concurrency = Math.min(12, Number(process.env.AI_CONCURRENCY ?? 10));
  let cursor = 0, analyzedNow = 0;
  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= batch.length) break;
      try { batch[i].cand.ai = withSafetyNet(batch[i].cand, batch[i].pub, await callOne(batch[i].cand, batch[i].pub, apiKey, model, jur, lang)); analyzedNow++; }
      catch (e) { console.error("[ai-web]", e instanceof Error ? e.message : e); }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));

  // Recalcular conteos y persistir
  const analyzedTotal = conflicts.filter((x) => x.cand.ai).length;
  const nOpp = conflicts.filter((x) => x.cand.ai?.recommendation === "file_opposition").length;
  const nMon = conflicts.filter((x) => x.cand.ai?.recommendation === "monitor_closely").length;
  // Tras ~10-20 s de llamadas a la IA el socket pudo quedar muerto → reintento.
  await withDbRetry(() => {
    const db = getDb()!;
    return db`
      UPDATE runs SET payload = ${db.json(dto as any)}, ai_ran = true, n_opposition = ${nOpp}, n_monitor = ${nMon}
      WHERE id = ${runId}
    `;
  });

  return { ok: true, analyzed: analyzedTotal, total, remaining: total - analyzedTotal };
}
