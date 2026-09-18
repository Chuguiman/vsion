// Prueba la conexión y ejecuta el esquema. Uso: tsx scripts/db-setup.ts
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
const sql = postgres(url, {
  ssl: url.includes("sslmode=disable") ? false : "require",
  max: 1,
  prepare: !isPooler,
});

const schema = readFileSync(new URL("../src/lib/schema.sql", import.meta.url), "utf8");

try {
  const [{ now }] = await sql`SELECT now()`;
  console.log("Conexión OK:", now);
  await sql.unsafe(schema);
  console.log("Esquema aplicado.");
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`;
  console.log("Tablas:", tables.map((t: any) => t.table_name).join(", "));
} catch (e) {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
