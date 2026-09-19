"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, History, Database, Users, Globe, CreditCard, UserCircle, LogOut, Menu as MenuIcon, X } from "lucide-react";
import { logoutAction } from "../auth-actions";

const ICONS: Record<string, React.ReactNode> = {
  search: <Search size={15} />, history: <History size={15} />, database: <Database size={15} />,
  users: <Users size={15} />, globe: <Globe size={15} />, billing: <CreditCard size={15} />, profile: <UserCircle size={15} />,
};

export interface NavLink { href: string; label: string; icon: string }

export default function NavMenu({ links, userName, role, avatar }: { links: NavLink[]; userName: string; role: string; avatar?: string | null }) {
  const [open, setOpen] = useState(false);
  const Avatar = ({ size }: { size: number }) => avatar
    ? <img src={avatar} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
    : <UserCircle size={size} className="text-[var(--mut)]" />;

  const LogoutForm = () => (
    <form action={logoutAction}>
      <button className="flex items-center gap-1 rounded-md border border-[var(--bd)] px-2 py-1 text-xs text-[var(--mut)] hover:text-[var(--tx)]">
        <LogOut size={13} /> Salir
      </button>
    </form>
  );

  return (
    <>
      {/* Desktop */}
      <nav className="ml-4 hidden flex-wrap items-center gap-4 text-sm text-[var(--mut)] sm:flex">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center gap-1 hover:text-[var(--tx)]">
            {ICONS[l.icon]} {l.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto hidden items-center gap-2 text-xs text-[var(--mut)] sm:flex">
        <Avatar size={26} />
        <span>{userName}</span>
        <LogoutForm />
      </div>

      {/* Móvil: botón hamburguesa */}
      <button onClick={() => setOpen(true)} className="ml-auto text-[var(--tx)] sm:hidden" aria-label="Menú">
        <MenuIcon size={22} />
      </button>

      {/* Panel móvil */}
      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 max-w-[80%] border-l border-[var(--bd)] bg-[var(--bg2)] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm"><Avatar size={28} /> <span>{userName}</span></div>
              <button onClick={() => setOpen(false)} aria-label="Cerrar"><X size={20} /></button>
            </div>
            <nav className="flex flex-col gap-1">
              {links.map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-white/5">
                  {ICONS[l.icon]} {l.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 border-t border-[var(--bd)] pt-4">
              <LogoutForm />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
