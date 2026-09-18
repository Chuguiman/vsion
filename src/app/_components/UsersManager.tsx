"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, Trash2 } from "lucide-react";
import { createUserAction, setRoleAction, deleteUserAction } from "../auth-actions";
import type { Role } from "@/lib/auth";
import type { UserRow } from "@/lib/users";

const ROLE_LABEL: Record<string, string> = { superadmin: "Superadmin", admin: "Administrador", user: "Usuario" };

export default function UsersManager({ users, canManage, currentUserId }: {
  users: UserRow[]; canManage: boolean; currentUserId: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" as Role });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await createUserAction(form.email, form.password, form.name, form.role);
    setBusy(false);
    if (r.ok) { setForm({ name: "", email: "", password: "", role: "user" }); router.refresh(); }
    else setError(r.error ?? "Error");
  }

  async function changeRole(id: number, role: Role) {
    const r = await setRoleAction(id, role);
    if (r.ok) router.refresh(); else setError(r.error ?? "Error");
  }

  async function remove(id: number) {
    if (!confirm("¿Eliminar esta cuenta?")) return;
    const r = await deleteUserAction(id);
    if (r.ok) router.refresh(); else setError(r.error ?? "Error");
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Usuarios</h1>

      {canManage && (
        <form onSubmit={create} className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--bd)] bg-[var(--bg2)] p-4">
          <div><label className="mb-1 block text-xs text-[var(--mut)]">Nombre</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
              className="w-40 rounded-lg border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--acc)]" /></div>
          <div><label className="mb-1 block text-xs text-[var(--mut)]">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required
              className="w-52 rounded-lg border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--acc)]" /></div>
          <div><label className="mb-1 block text-xs text-[var(--mut)]">Contraseña</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8}
              className="w-40 rounded-lg border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--acc)]" /></div>
          <div><label className="mb-1 block text-xs text-[var(--mut)]">Rol</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              className="rounded-lg border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--acc)]">
              <option value="user">Usuario</option>
              <option value="admin">Administrador</option>
            </select></div>
          <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[var(--acc)] px-4 py-2 text-sm font-medium text-black disabled:opacity-40">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Crear
          </button>
        </form>
      )}
      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-[var(--bd)] bg-[var(--bg2)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-[var(--mut)]">
              <th className="px-4 py-2 font-medium">Nombre</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Rol</th>
              {canManage && <th className="px-4 py-2 font-medium"></th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === currentUserId;
              return (
                <tr key={u.id} className="border-b border-[var(--bd)] last:border-0">
                  <td className="px-4 py-2.5">{u.name} {self && <span className="text-[11px] text-[var(--mut)]">(tú)</span>}</td>
                  <td className="px-4 py-2.5 text-[var(--mut)]">{u.email}</td>
                  <td className="px-4 py-2.5">
                    {canManage && !self && u.role !== "superadmin" ? (
                      <select defaultValue={u.role} onChange={(e) => changeRole(u.id, e.target.value as Role)}
                        className="rounded-md border border-[var(--bd)] bg-[var(--bg)] px-2 py-1 text-xs">
                        <option value="user">Usuario</option>
                        <option value="admin">Administrador</option>
                      </select>
                    ) : <span className={u.role === "superadmin" ? "text-[var(--acc)]" : ""}>{ROLE_LABEL[u.role]}</span>}
                  </td>
                  {canManage && (
                    <td className="px-4 py-2.5 text-right">
                      {!self && u.role !== "superadmin" && (
                        <button onClick={() => remove(u.id)} title="Eliminar" className="text-[var(--mut)] hover:text-red-300">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
