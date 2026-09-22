import { getDb } from "./db";
import type { GazetteMeta } from "@/types";

const orgKey = (orgId: number | null) => orgId ?? 0; // 0 = global (superadmin)

export interface ReusableGazette {
  id: number;
  country: string;
  number: string;
  date_public: string | null;
  pub_count: number;
}

/**
 * Inserta o actualiza la gaceta (única por país+número) y devuelve su id. Es
 * compartida por todas las organizaciones: distintas orgs que procesan la misma
 * gaceta apuntan al mismo gazette_id y reutilizan sus publicaciones e imágenes.
 */
export async function upsertGazette(meta: GazetteMeta): Promise<number | null> {
  const db = getDb();
  if (!db) return null;
  const [g] = await db<{ id: number }[]>`
    INSERT INTO gazettes (country, number, date_public, date_due, language, count)
    VALUES (${meta.country}, ${meta.number}, ${meta.datePublic || null}, ${meta.dateDue || null}, ${meta.language}, ${meta.count})
    ON CONFLICT (country, number) DO UPDATE SET
      date_public = COALESCE(EXCLUDED.date_public, gazettes.date_public),
      date_due    = COALESCE(EXCLUDED.date_due, gazettes.date_due),
      language    = EXCLUDED.language,
      count       = GREATEST(gazettes.count, EXCLUDED.count)
    RETURNING id`;
  return g?.id ?? null;
}

/** ¿La gaceta ya tiene sus publicaciones guardadas? (para reutilizar sin re-insertar). */
export async function gazetteHasPublications(gazetteId: number): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const [r] = await db<{ n: number }[]>`SELECT count(*)::int AS n FROM publications WHERE gazette_id = ${gazetteId}`;
  return (r?.n ?? 0) > 0;
}

/**
 * Gacetas ya cargadas que la organización puede comparar sin re-subir el archivo:
 * su país está habilitado (monitoreado y activo) para la org, tienen publicaciones
 * guardadas, y la org aún NO las ha comparado (sin run propio para esa gaceta).
 */
export async function listReusableGazettes(orgId: number | null): Promise<ReusableGazette[]> {
  const db = getDb();
  if (!db) return [];
  return db<ReusableGazette[]>`
    SELECT g.id, g.country, g.number, g.date_public::text AS date_public,
           (SELECT count(*)::int FROM publications p WHERE p.gazette_id = g.id) AS pub_count
    FROM gazettes g
    JOIN countries c ON upper(c.iso2) = upper(g.country)
    JOIN monitored_countries mc ON mc.country_id = c.id
      AND mc.organization_id = ${orgKey(orgId)} AND mc.is_active
    WHERE EXISTS (SELECT 1 FROM publications p WHERE p.gazette_id = g.id)
      AND NOT EXISTS (SELECT 1 FROM runs r WHERE r.organization_id = ${orgId} AND r.gazette_id = g.id)
    ORDER BY g.country, g.number DESC`;
}

/** Meta de una gaceta por id (para reconstruir la corrida al reutilizarla). */
export async function getGazetteMeta(gazetteId: number): Promise<GazetteMeta | null> {
  const db = getDb();
  if (!db) return null;
  const [g] = await db<{ country: string; number: string; date_public: string | null; date_due: string | null; language: string | null; count: number }[]>`
    SELECT country, number, date_public::text AS date_public, date_due::text AS date_due, language, count
    FROM gazettes WHERE id = ${gazetteId}`;
  if (!g) return null;
  return {
    country: g.country,
    number: g.number,
    datePublic: g.date_public ?? "",
    dateDue: g.date_due ?? "",
    language: g.language ?? "es",
    count: g.count ?? 0,
  };
}
