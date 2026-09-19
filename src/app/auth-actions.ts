"use server";

import { redirect } from "next/navigation";
import { getSession, setSessionCookie, clearSessionCookie } from "@/lib/auth";
import type { Role } from "@/lib/auth";
import { countUsers, findByEmail, createUser, verifyPassword, setRole, deleteUser, updateName, updateAvatar, changePassword } from "@/lib/users";

type Res = { ok: boolean; error?: string };

/** Registro. Bootstrap: si no hay usuarios, el primero es superadmin; luego cerrado. */
export async function registerAction(email: string, password: string, name: string): Promise<Res> {
  email = email.trim().toLowerCase();
  if (!email || !password || !name.trim()) return { ok: false, error: "Completa nombre, email y contraseña." };
  if (password.length < 8) return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
  try {
    const n = await countUsers();
    if (n > 0) return { ok: false, error: "El registro está cerrado. Pide a un administrador que cree tu cuenta." };
    if (await findByEmail(email)) return { ok: false, error: "Ese email ya está registrado." };
    const user = await createUser(email, password, name, "superadmin"); // primer usuario = superadmin
    await setSessionCookie({ userId: user.id, email: user.email, name: user.name, role: user.role });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al registrar." };
  }
}

export async function loginAction(email: string, password: string): Promise<Res> {
  email = email.trim().toLowerCase();
  try {
    const u = await findByEmail(email);
    if (!u || !(await verifyPassword(password, u.password_hash))) {
      return { ok: false, error: "Email o contraseña incorrectos." };
    }
    await setSessionCookie({ userId: u.id, email: u.email, name: u.name, role: u.role });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al iniciar sesión." };
  }
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

/** Registro abierto solo mientras no exista ningún usuario (para la UI). */
export async function registrationOpen(): Promise<boolean> {
  return (await countUsers()) === 0;
}

// ── Gestión de usuarios (solo superadmin) ──
async function requireSuperadmin() {
  const s = await getSession();
  if (s?.role !== "superadmin") throw new Error("No autorizado.");
  return s;
}

export async function createUserAction(email: string, password: string, name: string, role: Role): Promise<Res> {
  try {
    await requireSuperadmin();
    if (role === "superadmin") return { ok: false, error: "No se puede crear otro superadmin desde aquí." };
    if (!email.trim() || !name.trim() || password.length < 8) return { ok: false, error: "Datos incompletos (contraseña ≥ 8)." };
    if (await findByEmail(email)) return { ok: false, error: "Ese email ya existe." };
    await createUser(email, password, name, role);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error." };
  }
}

export async function setRoleAction(userId: number, role: Role): Promise<Res> {
  try {
    const s = await requireSuperadmin();
    if (userId === s.userId) return { ok: false, error: "No puedes cambiar tu propio rol." };
    await setRole(userId, role);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error." };
  }
}

export async function deleteUserAction(userId: number): Promise<Res> {
  try {
    const s = await requireSuperadmin();
    if (userId === s.userId) return { ok: false, error: "No puedes eliminar tu propia cuenta." };
    await deleteUser(userId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error." };
  }
}

// ── Perfil propio ──
export async function updateNameAction(name: string): Promise<Res> {
  const s = await getSession();
  if (!s) return { ok: false, error: "No autenticado." };
  if (!name.trim()) return { ok: false, error: "El nombre no puede estar vacío." };
  try {
    await updateName(s.userId, name);
    await setSessionCookie({ ...s, name: name.trim() }); // refresca el nombre en la sesión
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error." };
  }
}

export async function changePasswordAction(current: string, next: string): Promise<Res> {
  const s = await getSession();
  if (!s) return { ok: false, error: "No autenticado." };
  return changePassword(s.userId, current, next);
}

export async function updateAvatarAction(dataUrl: string | null): Promise<Res> {
  const s = await getSession();
  if (!s) return { ok: false, error: "No autenticado." };
  if (dataUrl && dataUrl.length > 400_000) return { ok: false, error: "La imagen es demasiado grande." };
  if (dataUrl && !/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl)) return { ok: false, error: "Formato de imagen no válido." };
  try {
    await updateAvatar(s.userId, dataUrl);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error." };
  }
}
