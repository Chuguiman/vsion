import postgres from "postgres";

// Conexión perezosa y OPCIONAL. Si no hay DATABASE_URL, la app corre igual
// (sin guardar historial). Patrón de conexión igual a samai-next.
const globalForDb = globalThis as unknown as { _vsionDb?: postgres.Sql };

export function getDb(): postgres.Sql | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!globalForDb._vsionDb) {
    globalForDb._vsionDb = postgres(url, {
      ssl: url.includes("sslmode=disable") ? false : "require",
      max: 5,
    });
  }
  return globalForDb._vsionDb;
}

export const dbEnabled = () => Boolean(process.env.DATABASE_URL);
