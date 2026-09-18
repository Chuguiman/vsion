"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { registerAction } from "../auth-actions";

export default function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await registerAction(email, password, name);
    if (r.ok) { window.location.href = "/"; return; }
    setError(r.error ?? "Error"); setBusy(false);
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="mb-6 flex items-center justify-center gap-2 text-lg font-semibold tracking-wide">
        <Search size={20} className="text-[var(--acc)]" /> vsion
      </div>
      <form onSubmit={submit} className="rounded-xl border border-[var(--bd)] bg-[var(--bg2)] p-6">
        <h1 className="mb-1 text-lg font-semibold">Crear cuenta de administrador</h1>
        <p className="mb-4 text-xs text-[var(--mut)]">Esta es la primera cuenta: quedará como superadmin.</p>
        <label className="mb-1 block text-xs text-[var(--mut)]">Nombre</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required
          className="mb-3 w-full rounded-lg border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--acc)]" />
        <label className="mb-1 block text-xs text-[var(--mut)]">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
          className="mb-3 w-full rounded-lg border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--acc)]" />
        <label className="mb-1 block text-xs text-[var(--mut)]">Contraseña (mín. 8)</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
          className="mb-4 w-full rounded-lg border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--acc)]" />
        {error && <p className="mb-3 text-sm text-red-300">{error}</p>}
        <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--acc)] px-4 py-2 font-medium text-black disabled:opacity-40">
          {busy && <Loader2 size={16} className="animate-spin" />} Crear cuenta
        </button>
        <p className="mt-4 text-center text-xs text-[var(--mut)]">
          ¿Ya tienes cuenta? <a href="/login" className="text-[var(--acc)] hover:underline">Iniciar sesión</a>
        </p>
      </form>
    </div>
  );
}
