"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { loginAction } from "../auth-actions";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await loginAction(email, password);
    if (r.ok) { window.location.href = "/"; return; }
    setError(r.error ?? "Error"); setBusy(false);
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="mb-6 flex items-center justify-center gap-2 text-lg font-semibold tracking-wide">
        <Search size={20} className="text-[var(--acc)]" /> vsion
      </div>
      <form onSubmit={submit} className="rounded-xl border border-[var(--bd)] bg-[var(--bg2)] p-6">
        <h1 className="mb-4 text-lg font-semibold">Iniciar sesión</h1>
        <label className="mb-1 block text-xs text-[var(--mut)]">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
          className="mb-3 w-full rounded-lg border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--acc)]" />
        <label className="mb-1 block text-xs text-[var(--mut)]">Contraseña</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
          className="mb-4 w-full rounded-lg border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--acc)]" />
        {error && <p className="mb-3 text-sm text-red-300">{error}</p>}
        <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--acc)] px-4 py-2 font-medium text-black disabled:opacity-40">
          {busy && <Loader2 size={16} className="animate-spin" />} Entrar
        </button>
        <p className="mt-4 text-center text-xs text-[var(--mut)]">
          ¿Primera vez? <a href="/register" className="text-[var(--acc)] hover:underline">Registrar</a>
        </p>
      </form>
    </div>
  );
}
