"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface StyledSelectOption {
  value: string;
  label: string;
}

export default function StyledSelect({
  value,
  defaultValue = "",
  options,
  onChange,
  className = "",
  compact = false,
  required = false,
  ariaLabel,
}: {
  value?: string;
  defaultValue?: string;
  options: StyledSelectOption[];
  onChange: (value: string) => void;
  className?: string;
  compact?: boolean;
  required?: boolean;
  ariaLabel?: string;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const selectedValue = value ?? internalValue;
  const selected = options.find((option) => option.value === selectedValue);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function choose(next: string) {
    if (value === undefined) setInternalValue(next);
    onChange(next);
    setOpen(false);
  }

  return (
    <div ref={root} className={`relative ${className}`}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel}
        aria-required={required} onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center justify-between gap-3 border border-[var(--bd)] bg-[var(--bg2)] text-left outline-none transition hover:border-[var(--acc)] focus:border-[var(--acc)] focus:ring-2 focus:ring-[var(--acc)]/20 ${compact ? "rounded-md px-2 py-1 text-xs" : "rounded-lg px-3 py-2 text-sm"}`}>
        <span className={`min-w-0 truncate ${selected ? "text-[var(--tx)]" : "text-[var(--mut)]"}`}>{selected?.label ?? "Selecciona una opción…"}</span>
        <ChevronDown size={compact ? 13 : 16} className={`shrink-0 text-[var(--mut)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="listbox" aria-label={ariaLabel} className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-[var(--bd)] bg-[var(--bg2)] p-1 shadow-xl shadow-black/30">
          {options.map((option) => {
            const active = option.value === selectedValue;
            return <button key={option.value} type="button" role="option" aria-selected={active} onClick={() => choose(option.value)}
              className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition ${compact ? "text-xs" : "text-sm"} ${active ? "bg-[var(--acc)]/15 text-[var(--tx)]" : "text-[var(--mut)] hover:bg-white/5 hover:text-[var(--tx)]"}`}>
              <span className="min-w-0 truncate">{option.label}</span>{active && <Check size={compact ? 13 : 15} className="shrink-0 text-[var(--acc)]" />}
            </button>;
          })}
        </div>
      )}
    </div>
  );
}
