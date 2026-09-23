// Importa una cartera (casos.json / formato gaceta) DIRECTO a client_marks para una
// organización, sin pasar por el server action (evita el límite de body en cargas
// grandes). Reemplaza solo la cartera de esa org. Uso:
//   tsx scripts/import-cartera-local.ts --file "<ruta.json>" --org <id>
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { parseClientMarks, parseClientMarksFromGazette } from "../src/load.ts";

function loadEnv() {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

function arg(name: string, def?: string) { const i = process.argv.indexOf(`--${name}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def; }
const FILE = arg("file");
const ORG = Number(arg("org", "0")) || 0;
if (!FILE || !ORG) { console.error("Uso: --file <ruta.json> --org <id>"); process.exit(1); }

const url = process.env.DATABASE_URL!;
const isPooler = url.includes(":6543") || url.includes("pgbouncer") || url.includes("pooler.supabase.com");
const sql = postgres(url, { ssl: url.includes("sslmode=disable") ? false : "require", max: 1, prepare: !isPooler });

try {
  const doc = JSON.parse(readFileSync(FILE, "utf8"));
  const marks = Array.isArray(doc) ? parseClientMarks(doc)
    : (doc && Array.isArray(doc.details) ? parseClientMarksFromGazette(doc) : null);
  if (!marks) throw new Error("Formato no reconocido (arreglo casos.json o {details}).");
  console.log(`Marcas parseadas: ${marks.length}`);

  await sql`DELETE FROM client_marks WHERE organization_id = ${ORG}`;
  const CHUNK = 500;
  for (let i = 0; i < marks.length; i += CHUNK) {
    const batch = marks.slice(i, i + CHUNK).map((m) => ({
      case_id: m.id, code: m.code, denom: m.denom, mark_type: m.markType, classes: m.classes,
      pys: m.pys, holder: m.holder, attorney: m.attorney, status: m.status,
      country: m.country, filed_date: m.filedDate, valid_until: m.validUntil, register_date: m.registerDate,
      organization_id: ORG,
    }));
    await sql`INSERT INTO client_marks ${sql(batch, "case_id", "code", "denom", "mark_type", "classes", "pys", "holder", "attorney", "status", "country", "filed_date", "valid_until", "register_date", "organization_id")}`;
    process.stdout.write(`\r${Math.min(i + CHUNK, marks.length)}/${marks.length}`);
  }
  const [c] = await sql<{ n: number }[]>`SELECT count(*)::int n FROM client_marks WHERE organization_id = ${ORG}`;
  console.log(`\nListo. client_marks org ${ORG}: ${c.n}`);
} catch (e) {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
