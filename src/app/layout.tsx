import type { Metadata } from "next";
import Link from "next/link";
import { Search, History, Database, Users, Globe, CreditCard, UserCircle, LogOut } from "lucide-react";
import { getSession } from "@/lib/auth";
import { logoutAction } from "./auth-actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "vsion — comparador de marcas",
  description: "Barrido fonético/textual + revisión IA de gacetas de marcas",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const role = session?.role;
  const isSuper = role === "superadmin";
  const isAdmin = role === "superadmin" || role === "admin";

  const links: { href: string; label: string; icon: React.ReactNode; show: boolean }[] = [
    { href: "/", label: "Nueva comparación", icon: <Search size={14} />, show: isSuper },
    { href: "/cartera", label: "Cartera", icon: <Database size={14} />, show: isSuper },
    { href: "/historial", label: "Historial", icon: <History size={14} />, show: !!role },
    { href: "/admin/usuarios", label: "Usuarios", icon: <Users size={14} />, show: isAdmin },
    { href: "/paises", label: "Países", icon: <Globe size={14} />, show: isAdmin },
    { href: "/billing", label: "Billing", icon: <CreditCard size={14} />, show: isAdmin },
    { href: "/perfil", label: "Perfil", icon: <UserCircle size={14} />, show: !!role },
  ];

  return (
    <html lang="es">
      <body>
        <header className="border-b border-[var(--bd)] bg-[var(--bg2)]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
            <Link href={isSuper ? "/" : "/historial"} className="flex items-center gap-2 font-semibold tracking-wide">
              <Search size={18} className="text-[var(--acc)]" /> vsion
            </Link>
            {role && (
              <nav className="flex flex-wrap items-center gap-4 text-sm text-[var(--mut)]">
                {links.filter((l) => l.show).map((l) => (
                  <Link key={l.href} href={l.href} className="flex items-center gap-1 hover:text-[var(--tx)]">
                    {l.icon} {l.label}
                  </Link>
                ))}
              </nav>
            )}
            {session && (
              <div className="ml-auto flex items-center gap-3 text-xs text-[var(--mut)]">
                <span>{session.name} · <span className="text-[var(--acc)]">{role}</span></span>
                <form action={logoutAction}>
                  <button className="flex items-center gap-1 rounded-md border border-[var(--bd)] px-2 py-1 hover:text-[var(--tx)]">
                    <LogOut size={13} /> Salir
                  </button>
                </form>
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
