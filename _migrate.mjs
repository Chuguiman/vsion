import postgres from "postgres";
import fs from "node:fs";
const get = (k) => fs.readFileSync(".env", "utf8").split(/\r?\n/).find((l) => l.startsWith(k + "=")).slice(k.length + 1).trim();
const sql = postgres(get("DATABASE_URL"), { ssl: false, max: 1, prepare: false, connect_timeout: 15 });
try {
  await sql`ALTER TABLE publications ADD COLUMN IF NOT EXISTS mark_category text`;
  // Backfill CO1114 (run 2) por application_number
  const doc = JSON.parse(fs.readFileSync("C:/Herd/procesaGacetas/paises_origen/sipi_sic_co/CO1114.json", "utf8"));
  const map = new Map();
  for (const d of doc.details ?? []) {
    const an = String(d.applicationNumber ?? "").trim();
    if (an) map.set(an, String(d.markCategory ?? "").trim());
  }
  let n = 0;
  for (const [an, cat] of map) {
    if (!cat) continue;
    const r = await sql`UPDATE publications SET mark_category=${cat} WHERE run_id=2 AND application_number=${an}`;
    n += r.count;
  }
  const [{ c }] = await sql`SELECT count(*)::int c FROM publications WHERE run_id=2 AND mark_category IS NOT NULL`;
  console.log("filas actualizadas:", n, "| con categoría:", c);
} catch (e) { console.error("ERROR:", e.message); }
finally { await sql.end({ timeout: 5 }); }
