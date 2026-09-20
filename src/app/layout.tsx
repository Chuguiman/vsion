import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getAvatar } from "@/lib/users";
import NavMenu, { type NavLink } from "./_components/NavMenu";
import ThemeToggle from "./_components/ThemeToggle";
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
            <ThemeToggle showLabel={!!session} className={session ? "" : "ml-auto"} />
          </div>
        </header>
        <div className={session ? "app-content lg:pl-64" : ""}>
          <main className="mx-auto min-w-0 max-w-6xl px-4 py-8 lg:px-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
