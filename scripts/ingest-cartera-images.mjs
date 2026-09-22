// Ingesta de imágenes de la CARTERA del cliente a Supabase Storage + cartera_images.
// La clave es (organización, code): el nombre de archivo (sin .webp) debe coincidir
// con client_marks.code de esa organización. Solo sube las que casan.
//
// Uso:
//   node scripts/ingest-cartera-images.mjs --dir "<carpeta>" --org <id> [--bucket cartera] [--limit N] [--concurrency 8]
import postgres from "postgres";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const DIR = arg("dir");
const ORG = Number(arg("org", "0")) || 0;
const BUCKET = arg("bucket", "cartera");
const LIMIT = Number(arg("limit", "0")) || 0;
const CONC = Number(arg("concurrency", "8")) || 8;
if (!DIR || !ORG) { console.error("Uso: --dir <carpeta> --org <id> [--bucket cartera] [--limit N] [--concurrency 8]"); process.exit(1); }

const env = fs.readFileSync(path.resolve(".env"), "utf8");
const get = (k) => env.split(/\r?\n/).find((l) => l.startsWith(k + "="))?.slice(k.length + 1).trim();
const DB = get("DATABASE_URL");
const SUPA = (get("NEXT_PUBLIC_SUPABASE_URL") || "").replace(/\/$/, "");
const KEY = get("SUPABASE_SERVICE_ROLE_KEY");
if (!DB || !SUPA || !KEY) { console.error("Faltan DATABASE_URL / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env"); process.exit(1); }

const isPooler = DB.includes(":6543") || DB.includes("pgbouncer") || DB.includes("pooler.supabase.com");
const sql = postgres(DB, { ssl: DB.includes("sslmode=disable") ? false : "require", max: 1, prepare: !isPooler, connect_timeout: 15 });
const H = { Authorization: `Bearer ${KEY}`, apikey: KEY };

async function ensureBucket() {
  const r = await fetch(`${SUPA}/storage/v1/bucket/${BUCKET}`, { headers: H });
  if (r.ok) return;
  const c = await fetch(`${SUPA}/storage/v1/bucket`, {
    method: "POST", headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  if (!c.ok) throw new Error(`No se pudo crear el bucket: ${c.status} ${await c.text()}`);
  console.log(`Bucket "${BUCKET}" creado (público).`);
}

async function dhash(buf) {
  const { data } = await sharp(buf).grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  let bits = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const i = y * 9 + x; bits += data[i] < data[i + 1] ? "1" : "0"; }
  let hex = ""; for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

async function uploadOne(file, code) {
  const objectPath = `${ORG}/${file}`;
  const buf = fs.readFileSync(path.join(DIR, file));
  const meta = await sharp(buf).metadata().catch(() => ({}));
  const phash = await dhash(buf);
  const up = await fetch(`${SUPA}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: { ...H, "Content-Type": "image/webp", "x-upsert": "true", "cache-control": "31536000" },
    body: buf,
  });
  if (!up.ok && up.status !== 200) throw new Error(`upload ${file}: ${up.status} ${await up.text()}`);
  await sql`
    INSERT INTO cartera_images (organization_id, code, bucket, path, phash, width, height)
    VALUES (${ORG}, ${code}, ${BUCKET}, ${objectPath}, ${phash}, ${meta.width ?? null}, ${meta.height ?? null})
    ON CONFLICT (organization_id, code) DO UPDATE SET bucket=${BUCKET}, path=${objectPath}, phash=${phash}, width=${meta.width ?? null}, height=${meta.height ?? null}`;
}

(async () => {
  await ensureBucket();
  // Códigos de la cartera de esta organización (para filtrar los archivos que casan).
  const rows = await sql`SELECT DISTINCT code FROM client_marks WHERE organization_id = ${ORG} AND code IS NOT NULL AND code <> ''`;
  const codes = new Set(rows.map((r) => String(r.code)));
  console.log(`Códigos en cartera org ${ORG}: ${codes.size}`);

  let files = fs.readdirSync(DIR).filter((f) => /\.webp$/i.test(f));
  const pairs = files
    .map((f) => ({ file: f, code: f.replace(/\.webp$/i, "") }))
    .filter((p) => codes.has(p.code));
  const skipped = files.length - pairs.length;
  let todo = pairs;
  if (LIMIT > 0) todo = todo.slice(0, LIMIT);
  console.log(`Archivos: ${files.length} · casan con cartera: ${pairs.length} · a subir: ${todo.length} (ignoradas por no casar: ${skipped})`);

  let done = 0, err = 0;
  for (let i = 0; i < todo.length; i += CONC) {
    const batch = todo.slice(i, i + CONC);
    const res = await Promise.allSettled(batch.map((p) => uploadOne(p.file, p.code)));
    for (const r of res) { if (r.status === "fulfilled") done++; else { err++; console.error(r.reason?.message || r.reason); } }
    process.stdout.write(`\r${done}/${todo.length} (${err} errores)`);
  }
  console.log(`\nListo. ${done} subidas, ${err} errores.`);
  const linked = await sql`SELECT count(*)::int n FROM client_marks cm JOIN cartera_images ci ON ci.organization_id = cm.organization_id AND ci.code = cm.code WHERE cm.organization_id = ${ORG}`;
  console.log(`Marcas de cartera con imagen vinculada (org ${ORG}): ${linked[0].n}`);
  await sql.end({ timeout: 5 });
})().catch((e) => { console.error(e); process.exit(1); });
