/**
 * Rehace una corrida (misma org + gaceta) con el barrido y la IA vigentes.
 * No borra la original: crea una corrida nueva y copia las revisiones humanas
 * de los pares que siguen presentes.
 *   tsx --env-file=.env scripts/rerun-run.ts <runId> [--dry] [--no-ai]
 */
import { getDb } from "../src/lib/db";
import { getGazetteMeta } from "../src/lib/gazettes";
import { loadGazetteEntries } from "../src/lib/publications";
import { loadMarksFromDb } from "../src/lib/cartera";
import { analyzeRunBatch } from "../src/lib/ai-web";
import { sweep } from "../src/sweep";
import { toReportDTO, type ReportDTO } from "../src/lib/dto";

const args = process.argv.slice(2);
const oldId = Number(args[0]);
const dry = args.includes("--dry"), noAi = args.includes("--no-ai");
const db = getDb();
if (!db || !oldId) throw new Error("Uso: rerun-run.ts <runId> [--dry] [--no-ai] (requiere DATABASE_URL)");

const [old] = await db<{ organization_id: number | null; gazette_id: number; payload: ReportDTO }[]>`
  SELECT organization_id, gazette_id, payload FROM runs WHERE id = ${oldId}`;
if (!old) throw new Error(`Corrida ${oldId} no existe`);
const meta = await getGazetteMeta(old.gazette_id);
if (!meta) throw new Error("Gaceta no encontrada");
const orgId = old.organization_id == null ? null : Number(old.organization_id);

const entries = await loadGazetteEntries(old.gazette_id);
const marks = await loadMarksFromDb({ orgId, country: meta.country });
const { candidates } = sweep(entries, marks);
const dto = toReportDTO(candidates, meta, { clientCount: marks.length, gazetteCount: entries.length, skipped: 0 });

const key = (g: { applicationNumber: string; denom: string }, c: { clientCode: string; clientDenom: string }) =>
  `${g.applicationNumber || g.denom}::${c.clientCode}::${c.clientDenom}`;
const newKeys = new Set(dto.groups.flatMap((g) => g.candidates.map((c) => key(g, c))));
const oldKeys = new Set(old.payload.groups.flatMap((g) => g.candidates.map((c) => key(g, c))));
const reviews = await db<{ cand_key: string; status: string; reviewed_by: number | null; reviewer_name: string | null }[]>`
  SELECT cand_key, status, reviewed_by, reviewer_name FROM reviews WHERE run_id = ${oldId}`;
const kept = reviews.filter((r) => newKeys.has(r.cand_key));

console.log(`Gaceta ${meta.country} ${meta.number} · ${entries.length} publicaciones · ${marks.length} marcas de cartera`);
console.log(`Antes (corrida ${oldId}): ${old.payload.stats.candidates} candidatos, ${old.payload.stats.conflict} conflictos`);
console.log(`Ahora: ${dto.stats.candidates} candidatos, ${dto.stats.conflict} conflictos (${dto.stats.own} propias, ${dto.stats.firm} de la firma)`);
console.log(`Pares que salen: ${[...oldKeys].filter((k) => !newKeys.has(k)).length} · nuevos: ${[...newKeys].filter((k) => !oldKeys.has(k)).length}`);
console.log(`Revisiones humanas: ${reviews.length}, se conservan ${kept.length} (las demás son de pares que ya no aparecen)`);
if (dry) { await db.end(); process.exit(0); }

const [row] = await db<{ id: number }[]>`
  INSERT INTO runs (country, gazette_number, date_public, date_due, language,
    client_count, gazette_count, n_candidates, n_own, ai_ran, payload, organization_id, gazette_id)
  VALUES (${meta.country}, ${meta.number}, ${meta.datePublic || null}, ${meta.dateDue || null}, ${meta.language},
    ${marks.length}, ${entries.length}, ${dto.stats.candidates}, ${dto.stats.own}, false, ${db.json(dto as any)}, ${orgId}, ${old.gazette_id})
  RETURNING id`;
const newId = Number(row.id);
for (const r of kept) {
  await db`INSERT INTO reviews (run_id, cand_key, status, reviewed_by, reviewer_name, updated_at)
    VALUES (${newId}, ${r.cand_key}, ${r.status}, ${r.reviewed_by}, ${r.reviewer_name}, now())`;
}
console.log(`Corrida nueva: ${newId} (revisiones copiadas: ${kept.length})`);

if (!noAi) {
  for (;;) {
    const r = await analyzeRunBatch(newId, 30);
    if (!r.ok) { console.error("IA:", r.error); break; }
    process.stderr.write(`IA ${r.analyzed}/${r.total}\n`);
    if (r.remaining === 0) break;
  }
  const [s] = await db<{ n_opposition: number; n_monitor: number }[]>`SELECT n_opposition, n_monitor FROM runs WHERE id = ${newId}`;
  console.log(`IA lista: ${s.n_opposition} oponerse · ${s.n_monitor} vigilar`);
}
await db.end();
