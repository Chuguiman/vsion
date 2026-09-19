"use client";

import { useState } from "react";
import { Mail, Lock, Loader2, ArrowRight, Search, Eye, EyeOff } from "lucide-react";
import { loginAction } from "../auth-actions";
import LoginArt from "./LoginArt";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await loginAction(email, password);
      if (r.ok) { window.location.assign("/"); return; }
      setError(r.error ?? "Error");
    } catch {
      setError("No se pudo conectar. Reintenta.");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-xl border border-[var(--bd)] bg-[var(--bg)] py-3 pl-11 pr-4 text-sm text-[var(--tx)] outline-none transition focus:border-[var(--acc)] focus:ring-4 focus:ring-violet-500/10 placeholder:text-[var(--mut)]";

  return (
    <div className="mx-[calc(50%-50vw)] my-[-2rem] flex min-h-[calc(100vh-57px)] w-screen">
      <div className="relative hidden w-1/2 overflow-hidden lg:block">
        <LoginArt />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f0d] via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12">
          <div className="mb-4 inline-flex w-fit items-center rounded-full border border-violet-500/30 bg-violet-500/15 px-4 py-1.5 text-sm font-medium text-violet-300 backdrop-blur-md">
            <span className="relative mr-2 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
            </span>
            Comparador de marcas con IA
          </div>
          <h2 className="max-w-md text-2xl font-bold leading-tight text-white">
            Vigilancia de marcas, más rápida y clara.
          </h2>
        </div>
      </div>

      <div className="relative flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16">
        <div className="pointer-events-none absolute right-[-10%] top-[10%] h-72 w-72 rounded-full bg-violet-500/10 blur-[120px]" />
        <div className="relative z-10 mx-auto w-full max-w-md">
          <div className="mb-8">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15">
              <Search size={22} className="text-[var(--acc)]" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Bienvenido a vsion</h1>
            <p className="mt-1 text-[var(--mut)]">Ingresa tus credenciales para continuar</p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                <p>{error}</p>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="ml-1 text-sm font-medium text-[var(--mut)]">Correo electrónico</label>
              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[var(--mut)] transition-colors group-focus-within:text-[var(--acc)]"><Mail size={18} /></div>
                <input type="email" required autoComplete="username" placeholder="nombre@ejemplo.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="ml-1 text-sm font-medium text-[var(--mut)]">Contraseña</label>
              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[var(--mut)] transition-colors group-focus-within:text-[var(--acc)]"><Lock size={18} /></div>
                <input type={show ? "text" : "password"} required autoComplete="current-password" placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} className={`${input} pr-11`} />
                <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Ocultar contraseña" : "Ver contraseña"}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-[var(--mut)] hover:text-[var(--tx)]">
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button disabled={busy} type="submit"
              className="group relative mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white shadow-[0_0_20px_rgba(139,92,246,0.2)] transition-all hover:bg-violet-500 hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] active:scale-[0.98] disabled:opacity-50">
              {busy ? <Loader2 className="animate-spin" size={20} /> : (<>Iniciar sesión <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></>)}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-[var(--mut)]">
            ¿Primera vez? <a href="/register" className="text-[var(--acc)] hover:underline">Crear cuenta</a>
          </p>
        </div>
        <p className="absolute bottom-6 left-0 right-0 text-center text-xs text-[var(--mut)]">
          © {new Date().getFullYear()} vsion · Propiedad Industrial
        </p>
      </div>
    </div>
  );
}
