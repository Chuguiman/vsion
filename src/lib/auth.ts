import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type Role = "superadmin" | "admin" | "user";
export interface Session {
  userId: number;
  email: string;
  name: string;
  role: Role;
}

const COOKIE = "vsion_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 días

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("Falta JWT_SECRET en el entorno.");
  return new TextEncoder().encode(s);
}

export async function encryptSession(payload: Session): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function decryptSession(token?: string): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { userId: Number(payload.userId), email: String(payload.email), name: String(payload.name), role: payload.role as Role };
  } catch {
    return null;
  }
}

/** Lee la sesión desde la cookie (server components / actions). */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return decryptSession(token);
}

export async function setSessionCookie(session: Session): Promise<void> {
  const token = await encryptSession(session);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/", maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export const SESSION_COOKIE = COOKIE;

/** Jerarquía de permisos */
export function can(role: Role | undefined, action: "upload" | "manage_users" | "view_admin" | "edit_review"): boolean {
  if (!role) return false;
  switch (action) {
    case "upload":        return role === "superadmin";
    case "edit_review":   return role === "superadmin";
    case "manage_users":  return role === "superadmin";
    case "view_admin":    return role === "superadmin" || role === "admin";
  }
}
