/**
 * Etapa 2 — Agente revisor IA vía OpenRouter (OpenAI-compatible).
 * System prompt portado de samai-next/src/lib/ai-analysis.ts (filtro de abogado).
 * Solo procesa los candidatos que sobrevivieron al barrido.
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { Candidate } from "./types.js";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

const JURISDICTION: Record<string, string> = {
  CO: "SIC Colombia", MX: "IMPI Mexico", ES: "OEPM Spain", US: "USPTO",
  PE: "INDECOPI Peru", CL: "INAPI Chile", EC: "SENADI Ecuador", BR: "INPI Brazil",
};

export const SYSTEM_PROMPT = `You are an expert trademark attorney specializing in opposition proceedings.
Your task: assess the likelihood of consumer confusion between an ORIGIN mark
(a new gazette application) and a CITED mark (the client's registered right),
and decide whether the case is worth a human attorney's time. You are a FILTER:
most cases must end in "no_action". Be ruthlessly critical. Only genuinely
confusable marks should pass through.

## INPUT (inside <case_data>)
- output_language: ISO code — write ai_reasoning and summary in this language.
- jurisdiction: trademark office where opposition would be filed. Defines the consumer.
- origin_mark: the NEW application under examination (gazette).
- cited_mark: the client's EXISTING registered mark.
- origin_classes, cited_classes: Nice classes with goods/services when available.
- classes_in_common: exact Nice matches ("none" if empty).
- related_classes: cross-class industry overlap ("none" if empty).
- similarity_score: pre-computed phonetic/textual score 0-100.

Base your analysis ONLY on the provided data. Never invent facts.

## DECISION PROCEDURE
STEP 1 — Class gate: if classes_in_common is "none" AND related_classes is
"none", output "no_action" immediately (different markets = no confusion).
STEP 2 — Similarity gate: output "no_action" if similarity_score < 55, OR the
dominant portions differ in sound/appearance/meaning, OR the only shared part
is a generic/descriptive prefix or suffix (AGR, BIO, TECH, FARM...).
STEP 3 — Classify:
- "file_opposition": strong phonetic/visual similarity in dominant portions AND
  at least one exact or related class. Average consumer would plausibly confuse.
- "monitor_closely": moderate but real similarity AND class overlap.
- otherwise "no_action".
CONSISTENCY: if your reasoning concludes low risk, recommendation MUST be no_action.

## OUTPUT
Respond ONLY with a JSON object, no markdown fences, keys in this order:
{
  "ai_reasoning": "phonetic, visual, conceptual comparison of dominant portions + class assessment + conclusion",
  "recommendation": "file_opposition" | "monitor_closely" | "no_action",
  "success_probability": <integer 0-100>,
  "summary": "2-4 sentence legal summary consistent with the reasoning"
}
success_probability must match recommendation: file_opposition 60-100,
monitor_closely 35-60, no_action 0-35.`;

function buildUserPrompt(c: Candidate, jurisdiction: string, lang: string): string {
  const fmt = (nums: number[], pys: string) => {
    if (!nums.length) return "none";
    return nums.join(", ") + (pys ? ` — ${pys.slice(0, 400)}` : "");
  };
  return [
    "<case_data>",
    `output_language: ${lang}`,
    `jurisdiction: ${jurisdiction}`,
    `origin_mark: ${c.gazette.denom}`,
    `origin_classes: ${fmt(c.gazette.classes, c.gazette.pys)}`,
    `cited_mark: ${c.client.denom}`,
    `cited_classes: ${fmt(c.client.classes, c.client.pys)}`,
    `classes_in_common: ${c.matchingClasses.join(", ") || "none"}`,
    `related_classes: ${c.relatedClasses.join(", ") || "none"}`,
    `similarity_score: ${c.score}`,
    "</case_data>",
  ].join("\n");
}

interface AiRaw {
  ai_reasoning?: string;
  recommendation?: string;
  success_probability?: number;
  summary?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callOne(
  c: Candidate, apiKey: string, model: string, jurisdiction: string, lang: string, maxRetries = 3
): Promise<Candidate["ai"]> {
  const userPrompt = buildUserPrompt(c, jurisdiction, lang);
  let lastErr: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1) + Math.random() * 500); // backoff exponencial + jitter
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://vsion.local",
          "X-Title": "vsion",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      // 429 y 5xx son transitorios → reintentar; 4xx (auth/pago) no
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 160)}`);
        continue;
      }
      if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      const text: string = data.choices?.[0]?.message?.content ?? "";
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) { lastErr = new Error("Sin JSON en la respuesta IA"); continue; }
      return parseResult(m[0], model);
    } catch (err) {
      lastErr = err; // error de red → reintentar
    }
  }
  throw lastErr ?? new Error("callOne agotó reintentos");
}

function parseResult(json: string, model: string): NonNullable<Candidate["ai"]> {
  const raw = JSON.parse(json) as AiRaw;
  const rec = (["file_opposition", "monitor_closely", "no_action"].includes(raw.recommendation ?? "")
    ? raw.recommendation : "no_action") as NonNullable<Candidate["ai"]>["recommendation"];
  return {
    recommendation: rec,
    success_probability: Math.max(0, Math.min(100, Math.round(raw.success_probability ?? 0))),
    summary: raw.summary ?? "",
    reasoning: raw.ai_reasoning ?? "",
    model,
  };
}

export interface ReviewOptions {
  apiKey: string;
  model: string;
  concurrency: number;
  jurisdiction: string;
  language: string;
  cachePath?: string;   // JSON persistente: key → veredicto. Re-runs saltan lo ya hecho.
  onProgress?: (done: number, total: number, failed: number) => void;
}

/** Clave estable de un par para el cache (independiente del score del barrido) */
function cacheKey(c: Candidate): string {
  return `${c.gazette.applicationNumber || c.gazette.denom}::${c.client.id || c.client.code}::${c.client.denom}`;
}

type Cache = Record<string, NonNullable<Candidate["ai"]>>;

function loadCache(path?: string): Cache {
  if (!path) return {};
  try { return JSON.parse(readFileSync(path, "utf8")) as Cache; } catch { return {}; }
}

/**
 * Revisa candidatos en paralelo. Muta cand.ai. Cachea a disco: los pares ya
 * resueltos en corridas previas se reutilizan (no se re-pagan) y solo se llaman
 * los pendientes — así los re-runs convergen sobre los fallos transitorios.
 */
export async function reviewCandidates(
  candidates: Candidate[], opts: ReviewOptions
): Promise<{ analyzed: number; failed: number; cached: number }> {
  const jur = JURISDICTION[opts.jurisdiction] ?? opts.jurisdiction;
  const cache = loadCache(opts.cachePath);

  // 1) Aplicar cache y separar pendientes
  const pending: Candidate[] = [];
  let cached = 0;
  for (const c of candidates) {
    const hit = cache[cacheKey(c)];
    if (hit) { c.ai = hit; cached++; } else pending.push(c);
  }

  let cursor = 0, analyzed = 0, failed = 0, sinceFlush = 0;
  const flush = () => { if (opts.cachePath) { try { writeFileSync(opts.cachePath, JSON.stringify(cache)); } catch {} } };

  const worker = async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= pending.length) break;
      const cand = pending[idx];
      try {
        const ai = await callOne(cand, opts.apiKey, opts.model, jur, opts.language);
        cand.ai = ai;
        if (ai) cache[cacheKey(cand)] = ai;
        analyzed++;
        if (++sinceFlush >= 20) { sinceFlush = 0; flush(); }
      } catch (err) {
        failed++;
        console.error(`[ai] fallo ${cand.gazette.denom} vs ${cand.client.denom}:`, err instanceof Error ? err.message : err);
      }
      opts.onProgress?.(analyzed + failed, pending.length, failed);
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency) }, worker));
  flush();
  return { analyzed, failed, cached };
}
