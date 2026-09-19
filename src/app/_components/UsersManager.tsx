"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, Trash2, Building2, Copy, Check } from "lucide-react";
import { createUserAction, setRoleAction, deleteUserAction, createOrgAction, setUserOrgAction } from "../auth-actions";
import type { Role } from "@/lib/auth";
import type { UserRow } from "@/lib/users";
import type { Org } from "@/lib/organizations";

const ROLE_LABEL: Record<string, string> = { superadmin: "Superadmin", admin: "Administrador", user: "Usuario" };

export default function UsersManager({ users, orgs, role, currentUserId, currentOrgId }: {
  users: UserRow[]; orgs: Org[]; role: Role; currentUserId: number; currentOrgId: number | null;
}) {
  const router = useRouter();
  const isSuper = role === "superadmin";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "user" as Role, organizationId: "" });
  const [orgName, setOrgName] = useState("");
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) return;
    setBusy(true); setError(null);
    const r = await createOrgAction(orgName);
    setBusy(false);
    if (r.ok) { setOrgName(""); router.refresh(); } else setError(r.error ?? "Error");
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setCreated(null);
    const r = await createUserAction({
      email: form.email, name: form.name, role: form.role,
      organizationId: isSuper ? (form.organizationId ? Number(form.organizationId) : null) : currentOrgId,
    });
    setBusy(false);
    if (r.ok) {
      setCreated({ email: form.email, password: r.tempPassword! });
      setForm({ name: "", email: "", role: "user", organizationId: "" });
      router.refresh();
    } else setError(r.error ?? "Error");
  }

  async function changeRole(id: number, r: Role) {
    const res = await setRoleAction(id, r);
    if (res.ok) router.refresh(); else setError(res.error ?? "Error");
  }
  async function remove(id: number) {
    if (!confirm("¿Eliminar esta cuenta?")) return;
    const res = await deleteUserAction(id);
    if (res.ok) router.refresh(); else setError(res.error ?? "Error");
  }
  async function changeOrg(id: number, orgId: string) {
    const res = await setUserOrgAction(id, orgId ? Number(orgId) : null);
    if (res.ok) router.refresh(); else setError(res.error ?? "Error");
  }

  const input = "rounded-lg border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--acc)]";
  const lbl = "mb-1 block text-xs text-[var(--mut)]";

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Usuarios{!isSuper && currentOrgId ? " · tu organización" : ""}</h1>

      {/* Superadmin: crear organización */}
      {isSuper && (
        <form onSubmit={createOrg} className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--bd)] bg-[var(--bg2)] p-4">
          <Building2 size={18} className="mb-2 text-[var(--acc)]" />
          <div><label className={lbl}>Nueva organización</label>
            <input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Provimarcas" className={`${input} w-56`} /></div>
          <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-[var(--bd)] px-3 py-2 text-sm hover:bg-white/5">Crear organización</button>
          <span className="ml-auto text-xs text-[var(--mut)]">{orgs.length} organizaciones</span>
        </form>
      )}

      {/* Crear usuario */}
      <form onSubmit={create} className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--bd)] bg-[var(--bg2)] p-4">
        <div><label className={lbl}>Nombre</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={`${input} w-40`} /></div>
        <div><label className={lbl}>Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className={`${input} w-52`} /></div>
        {isSuper && (
          <div><label className={lbl}>Organización</label>
            <select value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })} required className={input}>
              <option value="">Elegir…</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select></div>
        )}
        <div><label className={lbl}>Rol</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className={input}>
            <option value="user">Usuario</option>
            <option value="admin">Administrador</option>
          </select></div>
        <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[var(--acc)] px-4 py-2 text-sm font-medium text-black disabled:opacity-40">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Crear con contraseña temporal
        </button>
      </form>

      {created && (
        <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
          <p className="mb-2 text-emerald-300">Usuario creado: <b>{created.email}</b>. Comparte esta contraseña temporal (se muestra una sola vez):</p>
          <div className="flex items-center gap-2">
            <code className="rounded-lg border border-[var(--bd)] bg-[var(--bg)] px-3 py-1.5 font-mono text-base">{created.password}</code>
            <button onClick={() => { navigator.clipboard?.writeText(created.password); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--bd)] px-2 py-1.5 text-xs hover:bg-white/5">
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />} {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--mut)]">El usuario deberá cambiarla en su perfil.</p>
        </div>
      )}
      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-[var(--bd)] bg-[var(--bg2)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-[var(--mut)]">
              <th className="px-4 py-2 font-medium">Nombre</th>
              <th className="px-4 py-2 font-medium">Email</th>
              {isSuper && <th className="px-4 py-2 font-medium">Organización</th>}
              <th className="px-4 py-2 font-medium">Rol</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === currentUserId;
              const editable = !self && u.role !== "superadmin";
              return (
                <tr key={u.id} className="border-b border-[var(--bd)] last:border-0">
                  <td className="px-4 py-2.5">{u.name} {self && <span className="text-[11px] text-[var(--mut)]">(tú)</span>}</td>
                  <td className="px-4 py-2.5 text-[var(--mut)]">{u.email}</td>
                  {isSuper && (
                    <td className="px-4 py-2.5">
                      {u.role === "superadmin" ? <span className="text-[var(--acc)]">— global</span> : (
                        <select defaultValue={u.organization_id ?? ""} onChange={(e) => changeOrg(u.id, e.target.value)}
                          className="rounded-md border border-[var(--bd)] bg-[var(--bg)] px-2 py-1 text-xs">
                          <option value="">Sin organización</option>
                          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-2.5">
                    {editable ? (
                      <select defaultValue={u.role} onChange={(e) => changeRole(u.id, e.target.value as Role)} className="rounded-md border border-[var(--bd)] bg-[var(--bg)] px-2 py-1 text-xs">
                        <option value="user">Usuario</option>
                        <option value="admin">Administrador</option>
                      </select>
                    ) : <span className={u.role === "superadmin" ? "text-[var(--acc)]" : ""}>{ROLE_LABEL[u.role]}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {editable && <button onClick={() => remove(u.id)} title="Eliminar" className="text-[var(--mut)] hover:text-red-300"><Trash2 size={15} /></button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
