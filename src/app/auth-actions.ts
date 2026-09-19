"use server";

import { redirect } from "next/navigation";
import { getSession, setSessionCookie, clearSessionCookie } from "@/lib/auth";
import type { Role } from "@/lib/auth";
import { countUsers, findByEmail, createUser, verifyPassword, setRole, deleteUser, updateName, updateAvatar, changePassword, getUserOrg } from "@/lib/users";
import { createOrganization } from "@/lib/organizations";

type Res = { ok: boolean; error?: string };

function tempPassword(len = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

/** Registro. Bootstrap: si no hay usuarios, el primero es superadmin; luego cerrado. */
export async function registerAction(email: string, password: string, name: string): Promise<Res> {
  email = email.trim().toLowerCase();
  if (!email || !password || !name.trim()) return { ok: false, error: "Completa nombre, email y contraseña." };
  if (password.length < 8) return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
  try {
    const n = await countUsers();
    if (n > 0) return { ok: false, error: "El registro está cerrado. Pide a un administrador que cree tu cuenta." };
    if (await findByEmail(email)) return { ok: false, error: "Ese email ya está registrado." };
    const user = await createUser(email, password, name, "superadmin"); // primer usuario = superadmin (org null)
    await setSessionCookie({ userId: user.id, email, name: name.trim(), role: "superadmin", organizationId: null });
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
    await setSessionCookie({ userId: u.id, email: u.email, name: u.name, role: u.role, organizationId: u.organization_id ?? null });
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

// ── Organizaciones (solo superadmin) ──
export async function createOrgAction(name: string): Promise<Res & { id?: number }> {
  const s = await getSession();
  if (s?.role !== "superadmin") return { ok: false, error: "No autorizado." };
  if (!name.trim()) return { ok: false, error: "Nombre requerido." };
  try {
    const o = await createOrganization(name);
    return { ok: true, id: o.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error." };
  }
}

// ── Gestión de usuarios (superadmin global, admin dentro de su organización) ──
/** Crea un usuario con contraseña temporal (que se devuelve una sola vez). */
export async function createUserAction(input: { email: string; name: string; role: Role; organizationId: number | null }): Promise<Res & { tempPassword?: string }> {
  const s = await getSession();
  if (!s) return { ok: false, error: "No autenticado." };
  if (s.role !== "superadmin" && s.role !== "admin") return { ok: false, error: "No autorizado." };
  if (input.role === "superadmin") return { ok: false, error: "No se puede crear un superadmin." };

  // El admin solo crea en SU organización
  let orgId = input.organizationId;
  if (s.role === "admin") {
    orgId = s.organizationId ?? null;
    if (orgId == null) return { ok: false, error: "Tu cuenta no tiene organización." };
  } else {
    // superadmin: debe elegir organización para admin/user
    if (orgId == null) return { ok: false, error: "Elige una organización." };
  }

  if (!input.email.trim() || !input.name.trim()) return { ok: false, error: "Nombre y email requeridos." };
  if (await findByEmail(input.email)) return { ok: false, error: "Ese email ya existe." };
  try {
    const pw = tempPassword();
    await createUser(input.email, pw, input.name, input.role, orgId, true); // must_change = true
    return { ok: true, tempPassword: pw };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error." };
  }
}

// El admin solo puede tocar usuarios de su propia organización (no superadmins).
async function canManageTarget(s: NonNullable<Awaited<ReturnType<typeof getSession>>>, userId: number): Promise<Res> {
  if (userId === s.userId) return { ok: false, error: "No puedes modificar tu propia cuenta aquí." };
  const target = await getUserOrg(userId);
  if (!target) return { ok: false, error: "Usuario no encontrado." };
  if (target.role === "superadmin") return { ok: false, error: "No autorizado." };
  if (s.role === "admin" && target.organization_id !== s.organizationId) return { ok: false, error: "Fuera de tu organización." };
  return { ok: true };
}

export async function setRoleAction(userId: number, role: Role): Promise<Res> {
  const s = await getSession();
  if (!s || (s.role !== "superadmin" && s.role !== "admin")) return { ok: false, error: "No autorizado." };
  if (role === "superadmin") return { ok: false, error: "Rol no permitido." };
  const chk = await canManageTarget(s, userId);
  if (!chk.ok) return chk;
  try { await setRole(userId, role); return { ok: true }; }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Error." }; }
}

export async function deleteUserAction(userId: number): Promise<Res> {
  const s = await getSession();
  if (!s || (s.role !== "superadmin" && s.role !== "admin")) return { ok: false, error: "No autorizado." };
  const chk = await canManageTarget(s, userId);
  if (!chk.ok) return chk;
  try { await deleteUser(userId); return { ok: true }; }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Error." }; }
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
