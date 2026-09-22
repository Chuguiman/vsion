// Migración one-shot al modelo normalizado de gacetas.
// Backfill: crea gazettes desde runs, enlaza runs.gazette_id y publications.gazette_id,
// y de-duplica las publicaciones (una sola copia por gaceta). Idempotente.
// Uso: tsx scripts/migrate-gazettes.ts
import { readFileSync } from "node:fs";
import postgres from "postgres";

function loadEnv() {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const url = process.env.DATABASE_URL!;
const isPooler = url.includes(":6543") || url.includes("pgbouncer") || url.includes("pooler.supabase.com");
const sql = postgres(url, { ssl: url.includes("sslmode=disable") ? false : "require", max: 1, prepare: !isPooler });

try {
  const before = await sql`SELECT count(*)::int n FROM publications`;
  console.log("publicaciones antes:", before[0].n);

  // 1) Crear gacetas únicas a partir de las corridas existentes.
  const g = await sql`
    INSERT INTO gazettes (country, number, date_public, date_due, language, count)
    SELECT country, gazette_number, max(date_public), max(date_due), min(language), max(gazette_count)
    FROM runs
    WHERE country IS NOT NULL AND country <> '' AND gazette_number IS NOT NULL AND gazette_number <> ''
    GROUP BY country, gazette_number
    ON CONFLICT (country, number) DO NOTHING`;
  console.log("gacetas insertadas:", g.count);

  // 2) Enlazar cada corrida con su gaceta.
  const r = await sql`
    UPDATE runs r SET gazette_id = gz.id
    FROM gazettes gz
    WHERE gz.country = r.country AND gz.number = r.gazette_number AND r.gazette_id IS NULL`;
  console.log("runs enlazados:", r.count);

  // 3) Enlazar publicaciones con la gaceta de su corrida.
  const p = await sql`
    UPDATE publications p SET gazette_id = r.gazette_id
    FROM runs r
    WHERE r.id = p.run_id AND p.gazette_id IS NULL AND r.gazette_id IS NOT NULL`;
  console.log("publicaciones enlazadas:", p.count);

  // 4) De-duplicar: dejar una sola copia por gaceta (la del run_id más chico).
  const d = await sql`
    DELETE FROM publications p
    USING (SELECT gazette_id, min(run_id) AS keep_run FROM publications
           WHERE gazette_id IS NOT NULL GROUP BY gazette_id) k
    WHERE p.gazette_id = k.gazette_id AND (p.run_id IS DISTINCT FROM k.keep_run)`;
  console.log("publicaciones duplicadas borradas:", d.count);

  const after = await sql`SELECT count(*)::int n FROM publications`;
  const byG = await sql`SELECT count(*)::int gacetas, coalesce(sum(c),0)::int pubs FROM (
    SELECT gazette_id, count(*) c FROM publications WHERE gazette_id IS NOT NULL GROUP BY gazette_id) t`;
  const orphans = await sql`SELECT count(*)::int n FROM publications WHERE gazette_id IS NULL`;
  console.log("publicaciones después:", after[0].n);
  console.log("gacetas con publicaciones:", byG[0].gacetas, "· publicaciones vinculadas:", byG[0].pubs);
  console.log("publicaciones sin gaceta (legado):", orphans[0].n);
} catch (e) {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
