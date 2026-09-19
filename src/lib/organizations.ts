import { getDb } from "./db";

export interface Org { id: number; name: string; user_count?: number }

export async function listOrganizations(): Promise<Org[]> {
  const db = getDb();
  if (!db) return [];
  return db<Org[]>`
    SELECT o.id, o.name, count(u.id)::int AS user_count
    FROM organizations o LEFT JOIN users u ON u.organization_id = o.id
    GROUP BY o.id ORDER BY o.name
  `;
}

export async function createOrganization(name: string): Promise<Org> {
  const db = getDb();
  if (!db) throw new Error("Sin base de datos.");
  const [o] = await db<Org[]>`INSERT INTO organizations (name) VALUES (${name.trim()}) RETURNING id, name`;
  return o;
}

export async function orgName(id: number | null): Promise<string | null> {
  if (id == null) return null;
  const db = getDb();
  if (!db) return null;
  const [o] = await db<{ name: string }[]>`SELECT name FROM organizations WHERE id = ${id}`;
  return o?.name ?? null;
}
