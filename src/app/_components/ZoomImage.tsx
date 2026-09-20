"use client";

import { useState } from "react";
import { X } from "lucide-react";

/** Miniatura que abre la imagen ampliada en un overlay al hacer clic. */
export default function ZoomImage({ src, alt, size = 40 }: { src: string; alt: string; size?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Ampliar" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy"
          style={{ width: size, height: size }}
          className="rounded border border-[var(--bd)] bg-white object-contain transition hover:ring-2 hover:ring-[var(--acc)]" />
      </button>
      {open && (
        <div onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} aria-label="Cerrar"
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--bd)] bg-[var(--bg2)] text-[var(--tx)] hover:bg-white/10">
              <X size={16} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} className="max-h-[90vh] max-w-[90vw] rounded-lg bg-white object-contain shadow-2xl" />
            <p className="mt-2 text-center text-sm text-white/80">{alt}</p>
          </div>
        </div>
      )}
    </>
  );
}
