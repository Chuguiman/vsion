/**
 * vsion — comparador de marcas.
 *
 *   npm run compare -- <casos.json> <gaceta.json> [opciones]
 *   npm run sweep   -- <casos.json> <gaceta.json>          (solo barrido, sin IA)
 *
 * Opciones:
 *   --no-ai              solo Etapa 1 (barrido), no llama a la IA
 *   --ai-all             manda TODOS los candidatos a la IA (por defecto: pre-filtra)
 *   --threshold <n>      score mínimo del barrido (def 55)
 *   --topn <n>           máx candidatos por publicación (def 15)
 *   --out <dir>          carpeta de salida (def ./out)
 *   --model <id>         modelo OpenRouter (def env AI_MODEL)
 */
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { loadClientMarks, loadGazette } from "./load.js";
import { sweep, DEFAULT_SWEEP } from "./sweep.js";
import { reviewCandidates } from "./ai-review.js";
import { buildHtml } from "./report.js";
import { writeXlsx } from "./xls.js";
import { writeFileSync } from "node:fs";

// ── .env mínimo (sin dependencia) ─────────────────────────────────────
function loadEnv() {
  const p = resolve(process.cwd(), ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  loadEnv();
  const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const [casosPath, gacetaPath] = positional;
  if (!casosPath || !gacetaPath) {
    console.error("Uso: npm run compare -- <casos.json> <gaceta.json> [opciones]");
    process.exit(1);
  }

  const outDir = resolve(arg("out") ?? "out");
  mkdirSync(outDir, { recursive: true });

  const threshold = Number(arg("threshold") ?? DEFAULT_SWEEP.threshold);
  const topN = Number(arg("topn") ?? DEFAULT_SWEEP.topN);
  const useAi = !flag("no-ai");
  const aiAll = flag("ai-all");

  // ── Cargar ──────────────────────────────────────────────────────────
  console.log("Cargando datos...");
  const marks = loadClientMarks(resolve(casosPath));
  const { meta, entries, skipped } = loadGazette(resolve(gacetaPath));
  console.log(`  Marcas del cliente: ${marks.length}`);
  console.log(`  Publicaciones gaceta ${meta.country}${meta.number}: ${entries.length} (${skipped} sin denominación omitidas)`);

  // ── Etapa 1: barrido ────────────────────────────────────────────────
  console.log("\nEtapa 1 — barrido fonético/textual...");
  const { candidates, stats } = sweep(entries, marks, { threshold, topN, minSharedTrigrams: DEFAULT_SWEEP.minSharedTrigrams, minDenomLen: DEFAULT_SWEEP.minDenomLen });
  console.log(`  Pares evaluados: ${stats.pairsScored.toLocaleString()} en ${stats.elapsedMs} ms`);
  console.log(`  Candidatos (score >= ${threshold}): ${candidates.length}`);

  // ── Etapa 2: IA ─────────────────────────────────────────────────────
  let aiRan = false;
  if (useAi) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.warn("\n[aviso] Sin OPENROUTER_API_KEY — se omite la IA. Copia .env.example a .env y añade la key.");
    } else {
      const toReview = aiAll
        ? candidates
        : candidates.filter((c) => c.matchingClasses.length || c.relatedClasses.length || c.score >= 85);
      const model = arg("model") ?? process.env.AI_MODEL ?? "deepseek/deepseek-chat";
      const concurrency = Number(arg("concurrency") ?? process.env.AI_CONCURRENCY ?? 8);
      const cachePath = join(outDir, `${meta.country}${meta.number}-ai-cache.json`);
      console.log(`\nEtapa 2 — revisión IA (${model}, concurrencia ${concurrency})`);
      console.log(`  Candidatos a revisar: ${toReview.length}${aiAll ? "" : ` (pre-filtrados de ${candidates.length})`}`);

      const t0 = Date.now();
      const { analyzed, failed, cached } = await reviewCandidates(toReview, {
        apiKey, model, concurrency, jurisdiction: meta.country, language: meta.language, cachePath,
        onProgress: (done, total) => process.stdout.write(`\r  Progreso: ${done}/${total}   `),
      });
      process.stdout.write("\n");
      console.log(`  Reusados de cache: ${cached}, analizados ahora: ${analyzed}, fallidos: ${failed}, en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      if (failed > 0) console.log(`  Tip: vuelve a correr el mismo comando — el cache salta los ${cached + analyzed} ya resueltos y reintenta solo los ${failed} fallidos.`);
      aiRan = analyzed + cached > 0;
    }
  }

  // ── Salida ──────────────────────────────────────────────────────────
  const base = `${meta.country}${meta.number}-report`;
  const htmlPath = join(outDir, `${base}.html`);
  const xlsxPath = join(outDir, `${base}.xlsx`);
  writeFileSync(htmlPath, buildHtml(candidates, meta, aiRan), "utf8");
  writeXlsx(candidates, meta, xlsxPath);

  const opp = candidates.filter((c) => c.ai?.recommendation === "file_opposition").length;
  const mon = candidates.filter((c) => c.ai?.recommendation === "monitor_closely").length;
  console.log("\nListo.");
  if (aiRan) console.log(`  Oponerse: ${opp} · Vigilar: ${mon}`);
  console.log(`  HTML: ${htmlPath}`);
  console.log(`  XLSX: ${xlsxPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
