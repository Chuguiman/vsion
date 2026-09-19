import bcrypt from "bcryptjs";
import { getDb } from "./db";
import type { Role } from "./auth";

export interface UserRow {
  id: number;
  email: string;
  name: string;
  role: Role;
  created_at: string | Date;
}

export async function countUsers(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const [r] = await db<{ n: number }[]>`SELECT count(*)::int AS n FROM users`;
  return r?.n ?? 0;
}

export async function findByEmail(email: string) {
  const db = getDb();
  if (!db) return null;
  const [u] = await db<{ id: number; email: string; name: string; role: Role; password_hash: string }[]>`
    SELECT id, email, name, role, password_hash FROM users WHERE lower(email) = lower(${email}) LIMIT 1
  `;
  return u ?? null;
}

export async function createUser(email: string, password: string, name: string, role: Role): Promise<UserRow> {
  const db = getDb();
  if (!db) throw new Error("Sin base de datos.");
  const hash = await bcrypt.hash(password, 10);
  const [u] = await db<UserRow[]>`
    INSERT INTO users (email, password_hash, name, role)
    VALUES (${email.trim()}, ${hash}, ${name.trim()}, ${role})
    RETURNING id, email, name, role, created_at
  `;
  return u;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function listUsers(): Promise<UserRow[]> {
  const db = getDb();
  if (!db) return [];
  return db<UserRow[]>`SELECT id, email, name, role, created_at FROM users ORDER BY created_at ASC`;
}

export async function setRole(userId: number, role: Role): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Sin base de datos.");
  await db`UPDATE users SET role = ${role} WHERE id = ${userId}`;
}

export async function deleteUser(userId: number): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Sin base de datos.");
  await db`DELETE FROM users WHERE id = ${userId}`;
}

// ── Perfil propio ──
export async function getProfile(userId: number): Promise<{ id: number; email: string; name: string; role: Role; avatar: string | null } | null> {
  const db = getDb();
  if (!db) return null;
  const [u] = await db<{ id: number; email: string; name: string; role: Role; avatar: string | null }[]>`
    SELECT id, email, name, role, avatar FROM users WHERE id = ${userId} LIMIT 1
  `;
  return u ?? null;
}

export async function getAvatar(userId: number): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const [u] = await db<{ avatar: string | null }[]>`SELECT avatar FROM users WHERE id = ${userId}`;
  return u?.avatar ?? null;
}

export async function updateName(userId: number, name: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Sin base de datos.");
  await db`UPDATE users SET name = ${name.trim()} WHERE id = ${userId}`;
}

export async function updateAvatar(userId: number, avatar: string | null): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Sin base de datos.");
  await db`UPDATE users SET avatar = ${avatar} WHERE id = ${userId}`;
}

export async function changePassword(userId: number, current: string, next: string): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: "Sin base de datos." };
  const [u] = await db<{ password_hash: string }[]>`SELECT password_hash FROM users WHERE id = ${userId}`;
  if (!u) return { ok: false, error: "Usuario no encontrado." };
  if (!(await bcrypt.compare(current, u.password_hash))) return { ok: false, error: "La contraseña actual no es correcta." };
  if (next.length < 8) return { ok: false, error: "La nueva contraseña debe tener al menos 8 caracteres." };
  const hash = await bcrypt.hash(next, 10);
  await db`UPDATE users SET password_hash = ${hash} WHERE id = ${userId}`;
  return { ok: true };
}
