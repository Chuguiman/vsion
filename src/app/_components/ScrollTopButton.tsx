"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/** Botón flotante para volver arriba; aparece tras bajar ~1.5 pantallas. */
export default function ScrollTopButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 1.5);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button type="button" aria-label="Volver arriba" title="Volver arriba"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed bottom-5 right-5 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--bd)] bg-[var(--bg2)] text-[var(--acc)] shadow-lg transition hover:border-[var(--acc)] ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}>
      <ArrowUp size={20} />
    </button>
  );
}
