/** Revisión IA v2 de un par: expediente → IA (OpenRouter) → reglas. */
import { buildDossier, dossierPrompt, type PairInput } from "./ai-dossier";
import { SYSTEM_PROMPT_V2, finalize, gateVerdict, type AiV2 } from "./ai-verdict";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
export const JURISDICTION: Record<string, string> = {
  CO: "SIC Colombia", MX: "IMPI Mexico", ES: "OEPM Spain", US: "USPTO",
  PE: "INDECOPI Peru", CL: "INAPI Chile", EC: "SENADI Ecuador", BR: "INPI Brazil",
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface AiOpts {
  apiKey: string; model: string; jurisdiction: string; lang: string; maxRetries?: number;
  /** Costo en USD que informa OpenRouter por llamada (para topes de gasto). */
  onCost?: (usd: number) => void;
}

/** Sin clase común/relacionada y score < 85 → distinto mercado, no vale una llamada.
 *  Si a alguna de las dos le faltan las clases (dato incompleto de la gaceta) no se
 *  puede afirmar que sean mercados distintos → la revisa la IA. */
export const worthAi = (p: Pick<PairInput, "pubClasses" | "clientClasses" | "matching" | "related" | "score">) =>
  !p.pubClasses.length || !p.clientClasses.length || p.matching.length > 0 || p.related.length > 0 || p.score >= 85;

export async function reviewPair(p: PairInput, opts: AiOpts, wordFreq?: (w: string) => number): Promise<AiV2> {
  const d = buildDossier(p, wordFreq);
  if (!worthAi(p)) return gateVerdict(d);
  const prompt = dossierPrompt(p, d, opts.jurisdiction, opts.lang);
  let lastErr: unknown;
  for (let attempt = 0; attempt <= (opts.maxRetries ?? 3); attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1) + Math.random() * 400);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://vsion.local", "X-Title": "vsion" },
        body: JSON.stringify({
          model: opts.model, temperature: 0, response_format: { type: "json_object" }, usage: { include: true },
          messages: [{ role: "system", content: SYSTEM_PROMPT_V2 }, { role: "user", content: prompt }],
        }),
      });
      if (res.status === 429 || res.status >= 500) { lastErr = new Error(`OpenRouter ${res.status}`); continue; }
      if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 160)}`);
      const data = await res.json();
      if (typeof data.usage?.cost === "number") opts.onCost?.(data.usage.cost);
      const text: string = data.choices?.[0]?.message?.content ?? "";
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) { lastErr = new Error("Sin JSON"); continue; }
      return finalize(JSON.parse(m[0]), d, p);
    } catch (err) { lastErr = err; }
  }
  throw lastErr ?? new Error("agotó reintentos");
}

/** Frecuencia de cada palabra entre todas las denominaciones dadas (proxy de dilución). */
export function wordFrequency(denoms: Iterable<string>, norm: (s: string) => string[]): (w: string) => number {
  const df = new Map<string, number>();
  for (const d of new Set(denoms)) for (const w of new Set(norm(d))) df.set(w, (df.get(w) ?? 0) + 1);
  return (w) => df.get(w) ?? 0;
}
