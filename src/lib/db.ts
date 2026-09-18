import postgres from "postgres";

// Conexión perezosa y OPCIONAL. Si no hay DATABASE_URL, la app corre igual
// (sin guardar historial). Compatible con el pooler de Supabase (pgbouncer
// en modo transacción, puerto 6543) → prepare:false.
const globalForDb = globalThis as unknown as { _vsionDb?: postgres.Sql };

export function getDb(): postgres.Sql | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!globalForDb._vsionDb) {
    const isPooler = url.includes(":6543") || url.includes("pgbouncer") || url.includes("pooler.supabase.com");
    globalForDb._vsionDb = postgres(url, {
      ssl: url.includes("sslmode=disable") ? false : "require",
      max: isPooler ? 1 : 5,
      prepare: !isPooler, // pgbouncer transaction mode no soporta prepared statements
    });
  }
  return globalForDb._vsionDb;
}

export const dbEnabled = () => Boolean(process.env.DATABASE_URL);
