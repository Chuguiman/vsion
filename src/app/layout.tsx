import type { Metadata } from "next";
import Link from "next/link";
import { Search, History } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "vsion — comparador de marcas",
  description: "Barrido fonético/textual + revisión IA de gacetas de marcas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="border-b border-[var(--bd)] bg-[var(--bg2)]">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-wide">
              <Search size={18} className="text-[var(--acc)]" />
              vsion
            </Link>
            <nav className="flex items-center gap-4 text-sm text-[var(--mut)]">
              <Link href="/" className="hover:text-[var(--tx)]">Nueva comparación</Link>
              <Link href="/historial" className="flex items-center gap-1 hover:text-[var(--tx)]">
                <History size={14} /> Historial
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
