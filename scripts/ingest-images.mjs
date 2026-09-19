// Ingesta de imágenes de publicaciones a Supabase Storage + mark_images (dHash).
// Uso:
//   node scripts/ingest-images.mjs --dir "<carpeta>" --prefix CO1114 [--bucket publicaciones] [--limit N] [--concurrency 8]
// La clave es el NOMBRE de archivo (== id de imagen del SIC, con .webp).
import postgres from "postgres";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const DIR = arg("dir");
const PREFIX = arg("prefix", "");
const BUCKET = arg("bucket", "publicaciones");
const LIMIT = Number(arg("limit", "0")) || 0;
const CONC = Number(arg("concurrency", "8")) || 8;
if (!DIR) { console.error("Falta --dir"); process.exit(1); }

const env = fs.readFileSync(path.resolve(".env"), "utf8");
const get = (k) => env.split(/\r?\n/).find((l) => l.startsWith(k + "="))?.slice(k.length + 1).trim();
const DB = get("DATABASE_URL");
const SUPA = (get("NEXT_PUBLIC_SUPABASE_URL") || "").replace(/\/$/, "");
const KEY = get("SUPABASE_SERVICE_ROLE_KEY");
if (!DB || !SUPA || !KEY) { console.error("Faltan DATABASE_URL / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env"); process.exit(1); }

const sql = postgres(DB, { ssl: false, max: 1, prepare: false, connect_timeout: 15 });
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

async function uploadOne(file) {
  const objectPath = PREFIX ? `${PREFIX}/${file}` : file;
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
    INSERT INTO mark_images (image_id, bucket, path, phash, width, height)
    VALUES (${file}, ${BUCKET}, ${objectPath}, ${phash}, ${meta.width ?? null}, ${meta.height ?? null})
    ON CONFLICT (image_id) DO UPDATE SET bucket=${BUCKET}, path=${objectPath}, phash=${phash}, width=${meta.width ?? null}, height=${meta.height ?? null}`;
}

(async () => {
  await ensureBucket();
  let files = fs.readdirSync(DIR).filter((f) => /\.webp$/i.test(f));
  if (LIMIT > 0) files = files.slice(0, LIMIT);
  console.log(`Subiendo ${files.length} imágenes a ${BUCKET}/${PREFIX} …`);
  let done = 0, err = 0;
  for (let i = 0; i < files.length; i += CONC) {
    const batch = files.slice(i, i + CONC);
    const res = await Promise.allSettled(batch.map(uploadOne));
    for (const r of res) { if (r.status === "fulfilled") done++; else { err++; console.error(r.reason?.message || r.reason); } }
    process.stdout.write(`\r${done}/${files.length} (${err} errores)`);
  }
  console.log(`\nListo. ${done} subidas, ${err} errores.`);
  const linked = await sql`SELECT count(*)::int n FROM publications p JOIN mark_images mi ON mi.image_id = p.image_id`;
  console.log(`Publicaciones con imagen vinculada: ${linked[0].n}`);
  await sql.end({ timeout: 5 });
})().catch((e) => { console.error(e); process.exit(1); });
