import "server-only";
import { SignJWT } from "jose";
import type { Session } from "./auth";

/**
 * Firma un JWT compatible con Supabase para que el navegador pueda suscribirse a
 * Realtime SIN exponer datos con la anon key sola. El token lleva rol
 * `authenticated`, así la política RLS (solo `authenticated`) deja leer `reviews`.
 *
 * Solo se emite para usuarios ya logueados en nuestra app (sesión JWT propia).
 * Si falta SUPABASE_JWT_SECRET devuelve null → el cliente simplemente no activa
 * Realtime (la app sigue funcionando, sin sync en vivo).
 */
const TTL_SECONDS = 60 * 60 * 4; // 4 h; el cliente lo renueva antes de vencer

export function realtimeTokenTtl(): number {
  return TTL_SECONDS;
}

export async function mintSupabaseToken(session: Session): Promise<string | null> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) return null;
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(session.userId))
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(key);
}
