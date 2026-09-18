import { getSession } from "@/lib/auth";
import { UserCircle } from "lucide-react";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = { superadmin: "Superadmin", admin: "Administrador", user: "Usuario" };

export default async function PerfilPage() {
  const s = await getSession();
  if (!s) return null;
  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-xl font-semibold">Mi perfil</h1>
      <div className="rounded-xl border border-[var(--bd)] bg-[var(--bg2)] p-6">
        <div className="mb-4 flex items-center gap-3">
          <UserCircle size={40} className="text-[var(--mut)]" />
          <div>
            <div className="font-semibold">{s.name}</div>
            <div className="text-sm text-[var(--mut)]">{s.email}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-[var(--bd)] px-3 py-2">
            <div className="text-[11px] uppercase text-[var(--mut)]">Rol</div>
            <div className="text-[var(--acc)]">{ROLE_LABEL[s.role] ?? s.role}</div>
          </div>
          <div className="rounded-lg border border-[var(--bd)] px-3 py-2">
            <div className="text-[11px] uppercase text-[var(--mut)]">Cuenta</div>
            <div>#{s.userId}</div>
          </div>
        </div>
        <p className="mt-4 text-xs text-[var(--mut)]">El cambio de contraseña se añadirá próximamente.</p>
      </div>
    </div>
  );
}
