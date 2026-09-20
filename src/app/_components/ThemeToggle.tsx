"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle({ className = "", showLabel = false }: { className?: string; showLabel?: boolean }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("vsion-theme"); } catch {}
    setTheme(saved === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("vsion-theme", next); } catch {}
    if (next === "light") document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
  }

  return (
    <button onClick={toggle} aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={`theme-toggle inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--bd)] text-sm text-[var(--mut)] hover:bg-white/5 hover:text-[var(--tx)] ${showLabel ? "w-9 lg:w-full" : "w-9"} ${className}`}>
      {theme === "dark" ? <Sun size={16} className="shrink-0" /> : <Moon size={16} className="shrink-0" />}
      {showLabel && <span className="sidebar-label hidden lg:inline">{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>}
    </button>
  );
}
