import { getDb, withDbRetry } from "./db";
import { reviewPair, wordFrequency, JURISDICTION } from "@/ai-pair";
import { AI_VERSION } from "@/ai-verdict";
import { normWords } from "@/phonetics";
import { classOverlap } from "@/classes";
import type { PairInput } from "@/ai-dossier";
import type { ReportDTO, CandDTO, PubDTO } from "./dto";

/** Par para la IA. Las clases relacionadas se recalculan con la tabla vigente
 *  (el payload guarda las del barrido, que pueden ser de una tabla anterior). */
function pairOf(cand: CandDTO, pub: PubDTO): PairInput {
  const { matching, related } = classOverlap(pub.classes, cand.clientClasses);
  cand.matchingClasses = matching;
  cand.relatedClasses = related;
  return {
    pubDenom: pub.denom, pubClasses: pub.classes, pubPys: pub.pys,
    clientDenom: cand.clientDenom, clientClasses: cand.clientClasses, clientPys: cand.clientPys,
    matching, related, score: cand.score,
  };
}

/** ¿El veredicto guardado es de la versión vigente? (los v1 se re-analizan). */
export const isCurrentAi = (c: CandDTO) => !!c.ai && (c.ai.v ?? 1) >= AI_VERSION;

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

  // Dilución: cuántas denominaciones de la corrida (gaceta + cartera citada) usan cada palabra.
  const freq = wordFrequency(
    dto.groups.flatMap((g) => [g.denom, ...g.candidates.map((c) => c.clientDenom)]),
    (d) => normWords(d).split(" ").filter(Boolean),
  );
  const opts = { apiKey, model, jurisdiction: jur, lang };

  // Pendientes: sin veredicto o con veredicto de una versión anterior. La puerta de
  // clase (distinto mercado y score < 85) se resuelve sin llamada dentro de reviewPair.
  const pending = conflicts.filter((x) => !isCurrentAi(x.cand));
  const batch = pending.slice(0, batchSize);

  // Pool de concurrencia dentro del lote
  const concurrency = Math.min(12, Number(process.env.AI_CONCURRENCY ?? 10));
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= batch.length) break;
      try { batch[i].cand.ai = await reviewPair(pairOf(batch[i].cand, batch[i].pub), opts, freq); }
      catch (e) { console.error("[ai-web]", e instanceof Error ? e.message : e); }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));

  // Recalcular conteos y persistir
  const analyzedTotal = conflicts.filter((x) => isCurrentAi(x.cand)).length;
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
