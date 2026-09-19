import { getDb } from "./db";

export interface CountryRow {
  id: number;
  name: string;
  iso2: string;
  region: string | null;
  is_active: boolean;
}

const orgKey = (orgId: number | null) => orgId ?? 0; // 0 = global (superadmin)

/** Países maestros + si están monitoreados por la organización. */
export async function listCountries(orgId: number | null): Promise<CountryRow[]> {
  const db = getDb();
  if (!db) return [];
  return db<CountryRow[]>`
    SELECT c.id, c.name, c.iso2, c.region, COALESCE(mc.is_active, false) AS is_active
    FROM countries c
    LEFT JOIN monitored_countries mc ON mc.country_id = c.id AND mc.organization_id = ${orgKey(orgId)}
    WHERE c.status = 1
    ORDER BY COALESCE(mc.is_active, false) DESC, c.name
  `;
}

export async function setMonitored(orgId: number | null, countryId: number, active: boolean): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Sin base de datos.");
  await db`
    INSERT INTO monitored_countries (organization_id, country_id, is_active, updated_at)
    VALUES (${orgKey(orgId)}, ${countryId}, ${active}, now())
    ON CONFLICT (organization_id, country_id) DO UPDATE SET is_active = ${active}, updated_at = now()
  `;
}
