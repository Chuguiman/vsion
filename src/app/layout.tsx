import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getAvatar } from "@/lib/users";
import NavMenu, { type NavLink } from "./_components/NavMenu";
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

  const all: (NavLink & { show: boolean })[] = [
    { href: "/", label: "Nueva comparación", icon: "search", show: isSuper },
    { href: "/cartera", label: "Cartera", icon: "database", show: isSuper },
    { href: "/historial", label: "Historial", icon: "history", show: !!role },
    { href: "/admin/usuarios", label: "Usuarios", icon: "users", show: isAdmin },
    { href: "/paises", label: "Países", icon: "globe", show: isAdmin },
    { href: "/billing", label: "Billing", icon: "billing", show: isAdmin },
    { href: "/perfil", label: "Perfil", icon: "profile", show: !!role },
  ];
  const links: NavLink[] = all.filter((l) => l.show).map(({ href, label, icon }) => ({ href, label, icon }));
  const avatar = session ? await getAvatar(session.userId) : null;

  return (
    <html lang="es">
      <body>
        <header className="border-b border-[var(--bd)] bg-[var(--bg2)]">
          <div className="mx-auto flex max-w-6xl items-center gap-x-2 px-4 py-3">
            <Link href={isSuper ? "/" : "/historial"} className="flex items-center gap-2 font-semibold tracking-wide">
              <Search size={18} className="text-[var(--acc)]" /> vsion
            </Link>
            {session && <NavMenu links={links} userName={session.name} role={role!} avatar={avatar} />}
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
