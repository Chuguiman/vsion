"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, History, Database, Users, Globe, UserCircle, LogOut, PanelLeftClose, PanelLeftOpen, Menu as MenuIcon, X } from "lucide-react";
import { logoutAction } from "../auth-actions";

const ICONS: Record<string, React.ReactNode> = {
  search: <Search size={15} />, history: <History size={15} />, database: <Database size={15} />,
  users: <Users size={15} />, globe: <Globe size={15} />, profile: <UserCircle size={15} />,
};

export interface NavLink { href: string; label: string; icon: string }

export default function NavMenu({ links, userName, avatar }: { links: NavLink[]; userName: string; avatar?: string | null }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(document.documentElement.getAttribute("data-sidebar-collapsed") === "true");
  }, []);
  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    document.documentElement.toggleAttribute("data-sidebar-collapsed", next);
    if (next) document.documentElement.setAttribute("data-sidebar-collapsed", "true");
    try { localStorage.setItem("vsion-sidebar-collapsed", String(next)); } catch {}
  }
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)) || (href === "/historial" && pathname.startsWith("/runs/"));
  const Avatar = ({ size }: { size: number }) => avatar
    ? <img src={avatar} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
    : <UserCircle size={size} className="text-[var(--mut)]" />;

  const LogoutForm = () => (
    <form action={logoutAction}>
      <button aria-label="Salir" title="Salir" className="sidebar-logout flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--mut)] transition hover:bg-red-500/10 hover:text-red-400">
        <LogOut size={16} /> <span className="sidebar-label">Salir</span>
      </button>
    </form>
  );

  return (
    <>
      {/* Desktop */}
      <button onClick={toggleSidebar} aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
        title={collapsed ? "Expandir menú" : "Contraer menú"} aria-expanded={!collapsed} aria-controls="desktop-navigation"
        className="sidebar-toggle hidden h-8 w-8 items-center justify-center rounded-lg text-[var(--mut)] transition-colors hover:bg-white/5 hover:text-[var(--tx)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--acc)] lg:flex">
        {collapsed ? <PanelLeftOpen size={17} strokeWidth={1.6} /> : <PanelLeftClose size={17} strokeWidth={1.6} />}
      </button>
      <nav id="desktop-navigation" aria-label="Menú principal" className="hidden min-h-0 flex-1 flex-col gap-1 overflow-y-auto text-sm text-[var(--mut)] lg:flex">
        {links.map((l) => (
          <Link key={l.href} href={l.href} aria-label={l.label} title={l.label} aria-current={isActive(l.href) ? "page" : undefined} className={`sidebar-link flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-white/5 hover:text-[var(--tx)] ${isActive(l.href) ? "bg-white/5 text-[var(--acc)]" : ""}`}>
            {ICONS[l.icon]} <span className="sidebar-label">{l.label}</span>
          </Link>
        ))}
      </nav>
      {/* Móvil: botón hamburguesa */}
      <button onClick={() => setOpen(true)} className="ml-auto text-[var(--tx)] lg:hidden" aria-label="Menú" aria-expanded={open}>
        <MenuIcon size={22} />
      </button>

      {/* Panel móvil */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 max-w-[80%] border-l border-[var(--bd)] bg-[var(--bg2)] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm"><Avatar size={28} /> <span>{userName}</span></div>
              <button onClick={() => setOpen(false)} aria-label="Cerrar"><X size={20} /></button>
            </div>
            <nav className="flex flex-col gap-1">
              {links.map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-white/5 ${isActive(l.href) ? "bg-white/5 text-[var(--acc)]" : ""}`}>
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
