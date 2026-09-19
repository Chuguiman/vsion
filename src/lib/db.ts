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
      connect_timeout: 10,
      idle_timeout: 20,    // cierra conexiones ociosas para evitar sockets colgados
      max_lifetime: 60 * 5, // recicla la conexión para no arrastrar sockets muertos
    });
  }
  return globalForDb._vsionDb;
}

export const dbEnabled = () => Boolean(process.env.DATABASE_URL);

/** Cierra y descarta la conexión cacheada; el próximo getDb() reconecta fresco. */
export function resetDb(): void {
  const conn = globalForDb._vsionDb;
  globalForDb._vsionDb = undefined;
  if (conn) conn.end({ timeout: 1 }).catch(() => {});
}

/**
 * Ejecuta una consulta con límite de tiempo. En serverless el socket cacheado
 * puede quedar muerto tras congelarse la función: sin esto, la query cuelga
 * hasta el timeout de la plataforma (~min). Al vencer, descarta la conexión
 * para que el siguiente intento reconecte.
 */
export async function withDbTimeout<T>(op: () => Promise<T>, ms = 8000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      op(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          resetDb();
          reject(new Error("db_timeout"));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
