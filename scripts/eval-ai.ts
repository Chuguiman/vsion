/**
 * Mide la revisión IA v2 contra las decisiones humanas (aprobado/descartado).
 *   tsx scripts/eval-ai.ts <groundtruth.json> [--n 200] [--model x] [--out res.json]
 * groundtruth.json: [{ human, pub, pubClasses, pubPys, client, clientClasses, clientPys, score }]
 * "Acierto" = la IA marca (oponerse/vigilar) lo que el humano aprobó y descarta lo que descartó.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { reviewPair, wordFrequency, JURISDICTION } from "../src/ai-pair";
import { classOverlap } from "../src/classes";
import { normWords } from "../src/phonetics";
import type { AiV2 } from "../src/ai-verdict";

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const env = Object.fromEntries(readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }));
const model = opt("--model", env.AI_MODEL ?? "openai/gpt-4o-mini");
const N = Number(opt("--n", "200"));
const seed = Number(opt("--seed", "7"));

interface Row { run?: number | string; who?: string | null; human: "approved" | "discarded"; ai: string; pub: string; pubClasses: number[]; pubPys?: string; client: string; clientClasses: number[]; clientPys?: string; score: number }
const all: Row[] = JSON.parse(readFileSync(args[0], "utf8"));

// Pares citados como ejemplo en el prompt: fuera de la evaluación.
const IN_PROMPT = /DONDE FRANCESCA|CLINICA 134|NECESITA|RITUAL|COMFENALCO|HUMANA|OLMO CAPITAL|TURBO TECHNOLOGY|AXIONOVA|ULTRATRADE/i;
const seen = new Set<string>();
// --skip-runs 9: corridas donde la aprobación repitió el veredicto de la IA (no es criterio independiente).
const skipRuns = new Set(opt("--skip-runs", "").split(",").filter(Boolean));
const rows = all.filter((r) => {
  const k = `${r.pub}::${r.client}`;
  if (skipRuns.has(String(r.run))) return false;
  if (seen.has(k) || IN_PROMPT.test(r.pub + " " + r.client)) return false;
  seen.add(k); return true;
});

// Muestra estratificada reproducible: mitad aprobados, mitad descartados (sobre todo los que la IA v1 marcó: los difíciles).
let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
const shuffle = <T,>(a: T[]) => a.map((x) => [rnd(), x] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
const appr = shuffle(rows.filter((r) => r.human === "approved")).slice(0, N / 2);
const discFlag = shuffle(rows.filter((r) => r.human === "discarded" && r.ai !== "no_action" && r.ai !== "none")).slice(0, Math.round(N * 0.35));
const discNo = shuffle(rows.filter((r) => r.human === "discarded" && r.ai === "no_action")).slice(0, N / 2 - discFlag.length);
const sample = [...appr, ...discFlag, ...discNo];

const freq = wordFrequency(all.flatMap((r) => [r.pub, r.client]), (d) => normWords(d).split(" ").filter(Boolean));
// --budget 0.9: deja de lanzar llamadas al alcanzar ese gasto en USD (costo real informado por OpenRouter).
const budget = Number(opt("--budget", "Infinity"));
let spent = 0;
const opts = { apiKey: env.OPENROUTER_API_KEY, model, jurisdiction: JURISDICTION.CO, lang: "es", onCost: (c: number) => { spent += c; } };

const results: { row: Row; ai?: AiV2; err?: string }[] = [];
let cursor = 0;
await Promise.all(Array.from({ length: 10 }, async () => {
  while (cursor < sample.length && spent < budget) {
    const row = sample[cursor++];
    const { matching, related } = classOverlap(row.pubClasses, row.clientClasses);
    try {
      const ai = await reviewPair({ pubDenom: row.pub, pubClasses: row.pubClasses, pubPys: row.pubPys ?? "", clientDenom: row.client, clientClasses: row.clientClasses, clientPys: row.clientPys ?? "", matching, related, score: row.score }, opts, freq);
      results.push({ row, ai });
    } catch (e) { results.push({ row, err: String(e) }); }
    if (results.length % 25 === 0) process.stderr.write(`${results.length}/${sample.length}\n`);
  }
}));

function report(name: string, flagged: (r: { row: Row; ai?: AiV2 }) => boolean, subset = results.filter((r) => r.ai)) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const r of subset) { const f = flagged(r), a = r.row.human === "approved"; if (f && a) tp++; else if (f) fp++; else if (a) fn++; else tn++; }
  console.log(`${name.padEnd(28)} precisión ${(100 * tp / Math.max(1, tp + fp)).toFixed(0)}%  recall ${(100 * tp / Math.max(1, tp + fn)).toFixed(0)}%  | TP ${tp} FP ${fp} FN ${fn} TN ${tn}`);
}
const ok = results.filter((r) => r.ai);
const errs = results.filter((r) => r.err).map((r) => r.err!.slice(0, 90));
if (errs.length) console.log("errores:", [...new Set(errs)].slice(0, 5));
console.log(`modelo ${model} · ${ok.length} pares (${results.length - ok.length} errores) · gasto USD ${spent.toFixed(3)}`);
report("IA v1 (guardada)", (r) => r.row.ai === "file_opposition" || r.row.ai === "monitor_closely");
report("v2 oponerse+vigilar", (r) => r.ai!.recommendation !== "no_action");
report("v2 solo oponerse", (r) => r.ai!.recommendation === "file_opposition");
report("v2 IA cruda (sin reglas)", (r) => (r.ai!.llmRecommendation ?? "no_action") !== "no_action");
for (const who of [...new Set(ok.map((r) => r.row.who ?? "?"))]) {
  const sub = ok.filter((r) => (r.row.who ?? "?") === who);
  if (sub.length < 10) continue;
  console.log(`— revisor ${who} (${sub.length})`);
  report("  IA v1", (r) => r.row.ai === "file_opposition" || r.row.ai === "monitor_closely", sub);
  report("  v2 oponerse+vigilar", (r) => r.ai!.recommendation !== "no_action", sub);
}
const byLevel: Record<string, [number, number]> = {};
for (const r of ok) { const k = `${r.ai!.recommendation}/${r.ai!.level}`; byLevel[k] ??= [0, 0]; byLevel[k][r.row.human === "approved" ? 0 : 1]++; }
console.log("veredicto/nivel → [aprobados, descartados]", byLevel);

const out = opt("--out", "");
if (out) writeFileSync(out, JSON.stringify(ok.map((r) => ({
  run: r.row.run, who: r.row.who, human: r.row.human, v1: r.row.ai, pub: r.row.pub, pc: r.row.pubClasses,
  client: r.row.client, cc: r.row.clientClasses, score: r.row.score, ...r.ai,
})), null, 1));
