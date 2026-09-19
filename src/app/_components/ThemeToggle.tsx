"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle({ className = "" }: { className?: string }) {
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
    <button onClick={toggle} aria-label="Cambiar tema"
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--bd)] text-[var(--mut)] hover:text-[var(--tx)] ${className}`}>
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
