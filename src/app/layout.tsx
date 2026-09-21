import type { Metadata } from "next";
import Link from "next/link";
import { LogOut, Search, UserCircle } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getAvatar } from "@/lib/users";
import NavMenu, { type NavLink } from "./_components/NavMenu";
import ThemeToggle from "./_components/ThemeToggle";
import { logoutAction } from "./auth-actions";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";

const themeScript = `try{if(localStorage.getItem('vsion-theme')==='light')document.documentElement.setAttribute('data-theme','light');if(localStorage.getItem('vsion-sidebar-collapsed')==='true')document.documentElement.setAttribute('data-sidebar-collapsed','true')}catch(e){}`;

export const metadata: Metadata = {
  title: "vsion — comparador de marcas",
  description: "Barrido fonético/textual + revisión IA de gacetas de marcas",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const avatar = session ? await getAvatar(session.userId) : null;
  const role = session?.role;
  const isSuper = role === "superadmin";
  const isAdmin = role === "superadmin" || role === "admin";

  const all: (NavLink & { show: boolean })[] = [
    { href: "/", label: "Nueva comparación", icon: "search", show: isSuper },
    { href: "/cartera", label: "Cartera", icon: "database", show: isSuper },
    { href: "/historial", label: "Vigilancia", icon: "history", show: !!role },
    { href: "/admin/usuarios", label: "Usuarios", icon: "users", show: isAdmin },
    { href: "/paises", label: "Países", icon: "globe", show: isAdmin },
    { href: "/perfil", label: "Perfil", icon: "profile", show: !!role },
  ];
  const links: NavLink[] = all.filter((l) => l.show).map(({ href, label, icon }) => ({ href, label, icon }));

  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <header className={`border-b border-[var(--bd)] bg-[var(--bg2)] ${session ? "app-sidebar lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:w-64 lg:border-b-0 lg:border-r" : ""}`}>
          <div className={`mx-auto flex max-w-6xl items-center gap-x-2 px-4 py-3 ${session ? "lg:h-full lg:flex-col lg:items-stretch lg:gap-6 lg:p-4" : ""}`}>
            <Link href={isSuper ? "/" : "/historial"} aria-label="vsion — Inicio" title="vsion" className="sidebar-brand flex items-center gap-2 font-semibold tracking-wide">
              <Search size={18} className="shrink-0 text-[var(--acc)]" /> <span className="sidebar-label">vsion</span>
            </Link>
            {session && <NavMenu links={links} userName={session.name} avatar={avatar} />}
            <ThemeToggle className={session ? "lg:hidden" : "ml-auto"} />
          </div>
        </header>
        <div className={session ? "app-content lg:pl-64" : ""}>
          {session && (
            <header aria-label="Cuenta y apariencia" className="sticky top-0 z-30 hidden border-b border-[var(--bd)] bg-[var(--bg2)] lg:block">
              <div className="mx-auto flex min-h-18 max-w-6xl items-center justify-end gap-4 px-8 py-3">
                <Link href="/perfil" aria-label={`Perfil de ${session.name}`} title={session.name}
                  className="flex min-w-0 items-center gap-3 rounded-lg hover:text-[var(--acc)]">
                  {avatar
                    ? <img src={avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                    : <UserCircle size={36} className="shrink-0 text-[var(--mut)]" />}
                  <span className="max-w-64 truncate text-sm font-medium">{session.name}</span>
                </Link>
                <div className="h-6 w-px bg-[var(--bd)]" aria-hidden="true" />
                <ThemeToggle showLabel />
                <form action={logoutAction}>
                  <button type="submit" className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-[var(--mut)] transition hover:bg-red-500/10 hover:text-red-400">
                    <LogOut size={16} aria-hidden="true" /> Salir
                  </button>
                </form>
              </div>
            </header>
          )}
          <main className="mx-auto min-w-0 max-w-6xl px-4 py-8 lg:px-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
