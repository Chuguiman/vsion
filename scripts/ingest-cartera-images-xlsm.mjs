// Ingesta CORRECTA de imagenes de cartera extraidas de los .xlsm.
// Lee el manifiesto (codigo <-> archivo) generado por extract-xlsm-images.py y sube
// a Supabase Storage con clave = Numero de caso EXACTO (client_marks.code). Solo
// sube las que existen en la cartera de la organizacion.
//
// Uso:
//   node scripts/ingest-cartera-images-xlsm.mjs --dir "<carpeta con imagenes + manifest.csv>" --org <id> [--bucket cartera] [--concurrency 10]
import postgres from "postgres";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

function arg(name, def) { const i = process.argv.indexOf(`--${name}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def; }
const DIR = arg("dir");
const ORG = Number(arg("org", "0")) || 0;
const BUCKET = arg("bucket", "cartera");
const CONC = Number(arg("concurrency", "10")) || 10;
if (!DIR || !ORG) { console.error("Uso: --dir <carpeta> --org <id> [--bucket cartera] [--concurrency 10]"); process.exit(1); }

const env = fs.readFileSync(path.resolve(".env"), "utf8");
const get = (k) => env.split(/\r?\n/).find((l) => l.startsWith(k + "="))?.slice(k.length + 1).trim();
const DB = get("DATABASE_URL");
const SUPA = (get("NEXT_PUBLIC_SUPABASE_URL") || "").replace(/\/$/, "");
const KEY = get("SUPABASE_SERVICE_ROLE_KEY");
if (!DB || !SUPA || !KEY) { console.error("Faltan DATABASE_URL / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env"); process.exit(1); }

const isPooler = DB.includes(":6543") || DB.includes("pgbouncer") || DB.includes("pooler.supabase.com");
const sql = postgres(DB, { ssl: DB.includes("sslmode=disable") ? false : "require", max: 1, prepare: !isPooler, connect_timeout: 15 });
const H = { Authorization: `Bearer ${KEY}`, apikey: KEY };
const CT = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

async function ensureBucket() {
  const r = await fetch(`${SUPA}/storage/v1/bucket/${BUCKET}`, { headers: H });
  if (r.ok) return;
  const c = await fetch(`${SUPA}/storage/v1/bucket`, {
    method: "POST", headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  if (!c.ok) throw new Error(`No se pudo crear el bucket: ${c.status} ${await c.text()}`);
  console.log(`Bucket "${BUCKET}" creado (publico).`);
}

async function dhash(buf) {
  const { data } = await sharp(buf).grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  let bits = ""; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const i = y * 9 + x; bits += data[i] < data[i + 1] ? "1" : "0"; }
  let hex = ""; for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

function readManifest(dir) {
  const txt = fs.readFileSync(path.join(dir, "manifest.csv"), "utf8").split(/\r?\n/).filter(Boolean);
  const rows = [];
  for (let i = 1; i < txt.length; i++) {
    const [filename, code, , ext] = txt[i].split(","); // denom puede tener comas -> ignorado aqui
    if (filename && code) rows.push({ filename, code, ext: (ext || path.extname(filename).slice(1) || "jpg").toLowerCase() });
  }
  return rows;
}

async function uploadOne(row) {
  const ct = CT[row.ext] || "application/octet-stream";
  const objectPath = `${ORG}/${row.filename}`;
  const buf = fs.readFileSync(path.join(DIR, row.filename));
  const meta = await sharp(buf).metadata().catch(() => ({}));
  const phash = await dhash(buf).catch(() => null);
  const up = await fetch(`${SUPA}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "POST", headers: { ...H, "Content-Type": ct, "x-upsert": "true", "cache-control": "31536000" }, body: buf,
  });
  if (!up.ok && up.status !== 200) throw new Error(`upload ${row.filename}: ${up.status} ${await up.text()}`);
  await sql`
    INSERT INTO cartera_images (organization_id, code, bucket, path, phash, width, height)
    VALUES (${ORG}, ${row.code}, ${BUCKET}, ${objectPath}, ${phash}, ${meta.width ?? null}, ${meta.height ?? null})
    ON CONFLICT (organization_id, code) DO UPDATE SET bucket=${BUCKET}, path=${objectPath}, phash=${phash}, width=${meta.width ?? null}, height=${meta.height ?? null}`;
}

(async () => {
  await ensureBucket();
  const rows = await sql`SELECT DISTINCT code FROM client_marks WHERE organization_id = ${ORG} AND code IS NOT NULL AND code <> ''`;
  const codes = new Set(rows.map((r) => String(r.code)));
  console.log(`Codigos en cartera org ${ORG}: ${codes.size}`);

  const manifest = readManifest(DIR);
  // solo un archivo por codigo (el ultimo gana) y solo los que existen en cartera
  const byCode = new Map();
  for (const r of manifest) if (codes.has(r.code)) byCode.set(r.code, r);
  const todo = [...byCode.values()].filter((r) => fs.existsSync(path.join(DIR, r.filename)) && CT[r.ext]);
  const skippedFmt = [...byCode.values()].filter((r) => !CT[r.ext]).length;
  console.log(`Manifiesto: ${manifest.length} imagenes | casan con cartera: ${byCode.size} | a subir: ${todo.length}${skippedFmt ? ` (formato no soportado: ${skippedFmt})` : ""}`);

  let done = 0, err = 0;
  for (let i = 0; i < todo.length; i += CONC) {
    const batch = todo.slice(i, i + CONC);
    const res = await Promise.allSettled(batch.map(uploadOne));
    for (const r of res) { if (r.status === "fulfilled") done++; else { err++; console.error(r.reason?.message || r.reason); } }
    process.stdout.write(`\r${done}/${todo.length} (${err} errores)`);
  }
  const linked = await sql`SELECT count(*)::int n FROM client_marks cm JOIN cartera_images ci ON ci.organization_id=cm.organization_id AND ci.code=cm.code WHERE cm.organization_id=${ORG}`;
  console.log(`\nListo. ${done} subidas, ${err} errores. Marcas de cartera con imagen (org ${ORG}): ${linked[0].n}`);
  await sql.end({ timeout: 5 });
})().catch((e) => { console.error(e); process.exit(1); });
