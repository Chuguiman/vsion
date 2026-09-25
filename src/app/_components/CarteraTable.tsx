"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Search, Loader2, SlidersHorizontal, Columns3, ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, X, Check, ImageIcon,
} from "lucide-react";
import { listCarteraMarksAction } from "../actions";
import type { CarteraMark, CarteraMarksPage, CarteraSort } from "@/lib/cartera";
import ZoomImage from "./ZoomImage";

type ColKey = "filed" | "filingCountry" | "code" | "status" | "category" | "image" | "denom" | "markType"
  | "holder" | "country" | "classes" | "cert" | "pub" | "caseId" | "attorney";
type Col = { key: ColKey; label: string; sort?: CarteraSort; locked?: boolean; hidden?: boolean; className?: string };

const COLS: Col[] = [
  { key: "filed", label: "Radicación", sort: "filed", hidden: true },
  { key: "filingCountry", label: "País radicado", sort: "filingCountry" },
  { key: "code", label: "Expediente", sort: "code", locked: true },
  { key: "status", label: "Estado", sort: "status" },
  { key: "category", label: "Categoría", sort: "category", hidden: true },
  { key: "image", label: "Imagen" },
  { key: "denom", label: "Signo", sort: "denom", className: "min-w-[11rem]" },
  { key: "markType", label: "Tipo", sort: "markType", hidden: true },
  { key: "holder", label: "Titular", sort: "holder", className: "min-w-[12rem]" },
  { key: "country", label: "País titular", sort: "country", hidden: true },
  { key: "classes", label: "Clases" },
  { key: "cert", label: "Certificado · vigencia", sort: "valid", className: "min-w-[12rem]" },
  { key: "pub", label: "Publicación", sort: "pub", hidden: true },
  { key: "caseId", label: "Ref. SIC", sort: "caseId", hidden: true },
  { key: "attorney", label: "Apoderado", sort: "attorney", hidden: true, className: "min-w-[10rem]" },
];
const COLS_KEY = "vsion-cartera-hidden-cols-v3";
const SIZE_KEY = "vsion-cartera-page-size";
const PAGE_SIZES = [10, 25, 50, 100];

export default function CarteraTable({ orgId, onOpen }: { orgId: number | null; onOpen: (m: CarteraMark) => void }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<{ col: CarteraSort; dir: "asc" | "desc" } | null>(null);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [filingCountries, setFilingCountries] = useState<string[]>([]);
  const [classNums, setClassNums] = useState<number[]>([]);
  const [onlyImages, setOnlyImages] = useState(false);
  const [hidden, setHidden] = useState<ColKey[]>(() => COLS.filter((c) => c.hidden).map((c) => c.key));
  const [data, setData] = useState<CarteraMarksPage | null>(null);
  const [facets, setFacets] = useState<CarteraMarksPage["facets"]>();
  const [loading, setLoading] = useState(false);
  const [menu, setMenu] = useState<"filter" | "cols" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Preferencias por navegador: columnas ocultas y tamaño de página.
  useEffect(() => {
    try {
      const h = localStorage.getItem(COLS_KEY);
      if (h) setHidden(JSON.parse(h));
      const s = Number(localStorage.getItem(SIZE_KEY));
      if (PAGE_SIZES.includes(s)) setPageSize(s);
    } catch {}
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listCarteraMarksAction(orgId, {
      q, page, pageSize, onlyImages, statuses, countries, filingCountries, classNums,
      sort: sort?.col, dir: sort?.dir,
    })
      .then((r) => {
        if (!alive) return;
        setData(r.page ?? null);
        if (r.page?.facets) setFacets(r.page.facets);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [orgId, q, page, pageSize, onlyImages, statuses, countries, filingCountries, classNums, sort]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); };
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", esc); };
  }, [menu]);

  function onSearch(v: string) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setPage(1); setQ(v.trim()); }, 300);
  }
  function toggleIn<T>(set: (fn: (prev: T[]) => T[]) => void, v: T) {
    setPage(1);
    set((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }
  function toggleCol(key: ColKey) {
    setHidden((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try { localStorage.setItem(COLS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }
  function changeSize(n: number) {
    setPage(1);
    setPageSize(n);
    try { localStorage.setItem(SIZE_KEY, String(n)); } catch {}
  }
  function clickSort(col: CarteraSort) {
    setPage(1);
    setSort((s) => (s?.col !== col ? { col, dir: "asc" } : s.dir === "asc" ? { col, dir: "desc" } : null));
  }
  function clearFilters() {
    setPage(1); setStatuses([]); setCountries([]); setFilingCountries([]); setClassNums([]); setOnlyImages(false);
  }

  const cols = COLS.filter((c) => !hidden.includes(c.key));
  const nFilters = statuses.length + countries.length + filingCountries.length + classNums.length + (onlyImages ? 1 : 0);
  const from = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.page * data.pageSize, data.total) : 0;

  return (
    <div>
      {/* Barra de herramientas */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mut)]" />
          <input onChange={(e) => onSearch(e.target.value)} placeholder="Buscar marca, expediente, titular o apoderado"
            className="w-full rounded-lg border border-[var(--bd)] bg-[var(--bg2)] py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[var(--acc)] focus:ring-2 focus:ring-[var(--acc)]/20" />
        </div>

        <Popover open={menu === "filter"} onToggle={() => setMenu(menu === "filter" ? null : "filter")}
          button={<><SlidersHorizontal size={15} /> Filtros{nFilters > 0 && <Badge>{nFilters}</Badge>}</>}
          active={nFilters > 0} width="w-80">
          <FilterPanel facets={facets} statuses={statuses} countries={countries} filingCountries={filingCountries} classNums={classNums} onlyImages={onlyImages}
            withImages={data?.withImages ?? 0}
            onStatus={(v) => toggleIn(setStatuses, v)} onCountry={(v) => toggleIn(setCountries, v)} onFilingCountry={(v) => toggleIn(setFilingCountries, v)}
            onClass={(v) => toggleIn(setClassNums, v)} onImages={(v) => { setPage(1); setOnlyImages(v); }}
            onClear={clearFilters} />
        </Popover>

        <Popover open={menu === "cols"} onToggle={() => setMenu(menu === "cols" ? null : "cols")}
          button={<><Columns3 size={15} /> Columnas</>} width="w-56">
          <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--mut)]">Columnas visibles</div>
          {COLS.map((c) => (
            <CheckRow key={c.key} label={c.label} checked={!hidden.includes(c.key)} disabled={c.locked}
              onChange={() => toggleCol(c.key)} />
          ))}
          <button type="button" onClick={() => { setHidden([]); try { localStorage.setItem(COLS_KEY, "[]"); } catch {} }}
            className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-xs text-[var(--acc)] hover:bg-white/5">Mostrar todas</button>
        </Popover>

        <label className="flex items-center gap-2 text-xs text-[var(--mut)]">
          Mostrar
          <select value={pageSize} onChange={(e) => changeSize(Number(e.target.value))}
            className="rounded-md border border-[var(--bd)] bg-[var(--bg2)] px-2 py-1.5 text-xs text-[var(--tx)] outline-none focus:border-[var(--acc)]">
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      {/* Filtros activos */}
      {nFilters > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {statuses.map((v) => <Chip key={`s${v}`} label={`Estado: ${v}`} onRemove={() => toggleIn(setStatuses, v)} />)}
          {filingCountries.map((v) => <Chip key={`f${v}`} label={`Radicado en: ${countryName(v)}`} onRemove={() => toggleIn(setFilingCountries, v)} />)}
          {countries.map((v) => <Chip key={`c${v}`} label={`País titular: ${countryName(v)}`} onRemove={() => toggleIn(setCountries, v)} />)}
          {classNums.map((v) => <Chip key={`n${v}`} label={`Clase ${v}`} onRemove={() => toggleIn(setClassNums, v)} />)}
          {onlyImages && <Chip label="Con imagen" onRemove={() => { setPage(1); setOnlyImages(false); }} />}
          <button type="button" onClick={clearFilters} className="ml-1 text-xs text-[var(--mut)] underline-offset-2 hover:text-[var(--tx)] hover:underline">Limpiar</button>
        </div>
      )}

      {/* Tabla */}
      <div className="relative overflow-hidden rounded-xl border border-[var(--bd)] bg-[var(--bg2)]">
        {loading && data && <div className="absolute inset-x-0 top-0 z-20 h-0.5 animate-pulse bg-[var(--acc)]" />}
        <div className="max-h-[calc(100vh-15rem)] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--bg2)]">
              <tr className="border-b border-[var(--bd)]">
                {cols.map((c) => (
                  <th key={c.key} scope="col" className={`whitespace-nowrap px-4 py-3 text-left text-[11px] font-medium text-[var(--mut)] ${c.className ?? ""}`}
                    aria-sort={sort && sort.col === c.sort ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                    {c.sort ? (
                      <button type="button" onClick={() => clickSort(c.sort!)}
                        className={`inline-flex items-center gap-1 transition hover:text-[var(--tx)] ${sort?.col === c.sort ? "text-[var(--tx)]" : ""}`}>
                        {c.label}
                        {sort?.col === c.sort
                          ? (sort.dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />)
                          : <ChevronsUpDown size={12} className="opacity-50" />}
                      </button>
                    ) : c.label}
                  </th>
                ))}
                <th className="w-10" aria-label="Abrir" />
              </tr>
            </thead>
            <tbody className={loading && data ? "opacity-60 transition-opacity" : "transition-opacity"}>
              {!data && loading ? (
                <tr><td colSpan={cols.length + 1} className="px-4 py-12 text-center text-sm text-[var(--mut)]">
                  <Loader2 size={16} className="mr-2 inline animate-spin" />Cargando…
                </td></tr>
              ) : data && data.rows.length === 0 ? (
                <tr><td colSpan={cols.length + 1} className="px-4 py-12 text-center text-sm text-[var(--mut)]">
                  Sin marcas para esta búsqueda o filtros.
                  {nFilters > 0 && <button type="button" onClick={clearFilters} className="ml-2 text-[var(--acc)] hover:underline">Limpiar filtros</button>}
                </td></tr>
              ) : data?.rows.map((m) => (
                <tr key={m.id} tabIndex={0} onClick={() => onOpen(m)}
                  onKeyDown={(e) => { if (e.key === "Enter") onOpen(m); }}
                  className="group cursor-pointer border-b border-[var(--bd)] transition last:border-0 hover:bg-[var(--acc)]/[.06] focus:bg-[var(--acc)]/[.08] focus:outline-none">
                  {cols.map((c) => <td key={c.key} className="px-4 py-2.5 align-middle">{cell(c.key, m)}</td>)}
                  <td className="pr-3 text-right text-[var(--mut)]">
                    <ChevronRight size={16} className="inline opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100 group-focus:opacity-100" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pie: rango + paginación */}
        {data && data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--bd)] px-4 py-3 text-xs text-[var(--mut)]">
            <span>
              <b className="font-medium text-[var(--tx)]">{from.toLocaleString("es-CO")}–{to.toLocaleString("es-CO")}</b> de {data.total.toLocaleString("es-CO")} marcas
              {data.withImages > 0 && <> · {data.withImages.toLocaleString("es-CO")} con imagen</>}
            </span>
            {data.pages > 1 && <Pager page={data.page} pages={data.pages} disabled={loading} onPage={setPage} />}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────── celdas ───────────── */

function cell(key: ColKey, m: CarteraMark): ReactNode {
  switch (key) {
    case "filed": return <DateText value={m.filedDate} />;
    case "filingCountry": return <Country code={m.filingCountry} />;
    case "code": return <span className="whitespace-nowrap font-mono text-xs">{m.code || <Dash />}</span>;
    case "status": return <StatusPill status={m.status} />;
    case "category": return m.category ? <span className="whitespace-nowrap text-xs">{m.category}</span> : <Dash />;
    case "image": return <ImageCell m={m} />;
    case "denom": return isFigurative(m) ? <Dash />
      : <span className="line-clamp-2 font-medium text-[var(--tx)]" title={m.denom}>{m.denom}</span>;
    case "markType": return <TypeCell m={m} />;
    case "holder": return m.holder ? <span className="line-clamp-2 text-xs" title={m.holder}>{m.holder}</span> : <Dash />;
    case "country": return <Country code={m.country} />;
    case "classes": return <ClassList classes={m.classes} />;
    case "cert": return <CertCell m={m} />;
    case "pub": return <PubCell m={m} />;
    case "caseId": return <span className="whitespace-nowrap font-mono text-xs text-[var(--mut)]">{m.caseId || <Dash />}</span>;
    case "attorney": return m.attorney ? <span className="line-clamp-2 text-xs text-[var(--mut)]" title={m.attorney}>{m.attorney}</span> : <Dash />;
  }
}

function Dash() { return <span className="text-[var(--mut)]/60">—</span>; }

/** Figurativa: sin expresión denominativa (tipo informado o denominación vacía). */
function isFigurative(m: CarteraMark) {
  return /figurativ/i.test(m.markType) || !m.denom.trim();
}

function DateText({ value }: { value: string }) {
  return value ? <span className="whitespace-nowrap font-mono text-xs text-[var(--mut)]">{fmtDate(value)}</span> : <Dash />;
}

function ImageCell({ m }: { m: CarteraMark }) {
  if (m.imageUrl) {
    return <span className="block w-fit" onClick={(e) => e.stopPropagation()}><ZoomImage src={m.imageUrl} alt={m.denom || m.code} size={40} /></span>;
  }
  if (!m.denom.trim()) {
    return <span className="grid h-10 w-10 place-items-center rounded border border-dashed border-[var(--bd)] text-[var(--mut)]" title="Sin imagen"><ImageIcon size={14} /></span>;
  }
  return (
    <span className="grid h-10 w-10 place-items-center rounded-lg text-sm font-semibold" aria-hidden="true"
      style={{ background: `hsl(${hue(m.denom)} 55% 55% / .15)`, color: `hsl(${hue(m.denom)} 60% 62%)` }}>
      {m.denom.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function TypeCell({ m }: { m: CarteraMark }) {
  if (m.markType) return <span className="whitespace-nowrap text-xs">{m.markType}</span>;
  // Sin tipo en la fuente: sin denominación solo puede ser figurativa (o 3D/animada).
  if (!m.denom.trim()) return <span className="whitespace-nowrap text-xs text-[var(--mut)]" title="Deducido: sin denominación">Figurativa</span>;
  return <Dash />;
}

function PubCell({ m }: { m: CarteraMark }) {
  if (!m.pubNumber && !m.pubDate) return <Dash />;
  return (
    <span className="block whitespace-nowrap leading-tight">
      {m.pubNumber && <span className="block font-mono text-xs">N.º {m.pubNumber}</span>}
      {m.pubDate && <span className={`block font-mono ${m.pubNumber ? "text-[10px]" : "text-xs"} text-[var(--mut)]`}>{fmtDate(m.pubDate)}</span>}
    </span>
  );
}

function ClassList({ classes }: { classes: number[] }) {
  if (!classes.length) return <Dash />;
  const shown = classes.slice(0, 4);
  return (
    <span className="inline-flex flex-nowrap gap-1" title={`Clases Niza: ${classes.join(", ")}`}>
      {shown.map((n) => <span key={n} className="rounded border border-[var(--bd)] px-1.5 py-px font-mono text-[11px] text-[var(--mut)]">{n}</span>)}
      {classes.length > shown.length && <span className="rounded bg-[var(--bd)]/50 px-1.5 py-px font-mono text-[11px] text-[var(--mut)]">+{classes.length - shown.length}</span>}
    </span>
  );
}

function statusTone(s: string) {
  const v = s.toLowerCase();
  if (!v) return "bg-zinc-500/10 text-[var(--mut)] ring-zinc-500/20";
  if (v.includes("registrad") || v.includes("concedid") || v.includes("vigente")) return "bg-emerald-500/10 text-emerald-500 ring-emerald-500/25";
  if (v.includes("publicad")) return "bg-sky-500/10 text-sky-500 ring-sky-500/25";
  if (v.includes("examen") || v.includes("trámite") || v.includes("tramite")) return "bg-amber-500/10 text-amber-500 ring-amber-500/25";
  if (v.includes("negad") || v.includes("cancel") || v.includes("vencid") || v.includes("abandon") || v.includes("caducad")) return "bg-rose-500/10 text-rose-500 ring-rose-500/25";
  return "bg-violet-500/10 text-violet-400 ring-violet-500/25";
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${statusTone(status)}`}>
      {status || "Sin estado"}
    </span>
  );
}

function Country({ code }: { code: string }) {
  if (!code) return <Dash />;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs" title={countryName(code)}>
      <Flag code={code} />
      {code}
    </span>
  );
}

function Flag({ code }: { code: string }) {
  if (!/^[A-Za-z]{2}$/.test(code)) return <span className="inline-block shrink-0" style={{ width: 18, height: 13 }} />;
  return <span className={`fi fi-${code.toLowerCase()} shrink-0 rounded-[2px]`} style={{ width: 18, height: 13 }} />;
}

const regionNames = (() => { try { return new Intl.DisplayNames(["es"], { type: "region" }); } catch { return null; } })();

/** "CO" → "Colombia". Si no es un código ISO reconocido, devuelve el valor tal cual. */
function countryName(code: string) {
  if (!/^[A-Za-z]{2}$/.test(code)) return code === "—" ? "Sin país" : code;
  try { return regionNames?.of(code.toUpperCase()) ?? code; } catch { return code; }
}

/** Lista de países con bandera y nombre; con muchos, añade un buscador y scroll. */
function CountryList({ facets, selected, onToggle }: { facets: { value: string; count: number }[]; selected: string[]; onToggle: (v: string) => void }) {
  const [find, setFind] = useState("");
  const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const f = norm(find.trim());
  const items = facets.filter((x) => !f || norm(countryName(x.value)).includes(f) || x.value.toLowerCase().includes(f));
  return (
    <>
      {facets.length > 8 && (
        <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Buscar país…"
          className="mx-2 mb-1 w-[calc(100%-1rem)] rounded-md border border-[var(--bd)] bg-transparent px-2 py-1 text-xs outline-none focus:border-[var(--acc)]" />
      )}
      <div className="max-h-52 overflow-y-auto">
        {items.map((x) => (
          <CheckRow key={x.value} label={countryName(x.value)} icon={<Flag code={x.value} />} count={x.count}
            checked={selected.includes(x.value)} onChange={() => onToggle(x.value)} />
        ))}
        {!items.length && <div className="px-2 py-1.5 text-xs text-[var(--mut)]">Sin coincidencias.</div>}
      </div>
    </>
  );
}

/** N.º de certificado + barra segmentada con los años de vigencia restantes (sobre un periodo de 10 años). */
function CertCell({ m }: { m: CarteraMark }) {
  const end = m.validUntil ? parseDate(m.validUntil) : null;
  const cert = m.certNumber ? <span className="block whitespace-nowrap font-mono text-xs">N.º {m.certNumber}</span> : null;
  if (!end) {
    if (!cert && !m.validUntil) return <Dash />;
    return <span className="block leading-tight">{cert}{m.validUntil && <span className="block text-xs">{m.validUntil}</span>}</span>;
  }
  const years = (end.getTime() - Date.now()) / (365.25 * 864e5);
  const filled = Math.max(0, Math.min(10, Math.ceil(years)));
  const color = years < 0 ? "bg-rose-500" : years < 1 ? "bg-rose-400" : years < 3 ? "bg-amber-400" : "bg-emerald-400";
  const label = years < 0 ? "Vencida" : years < 1 ? `${Math.max(0, Math.round(years * 12))} meses` : `${years.toFixed(1).replace(".", ",")} años`;
  return (
    <div className="flex items-center gap-3" title={`Vence el ${fmtDate(m.validUntil)}`}>
      <span className="flex gap-[2px]" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={`h-4 w-[3px] rounded-full ${i < filled ? color : "bg-[var(--bd)]"}`} />
        ))}
      </span>
      <span className="min-w-0 leading-tight">
        {cert}
        <span className="block whitespace-nowrap font-mono text-xs">{fmtDate(m.validUntil)}</span>
        <span className={`block whitespace-nowrap text-[10px] ${years < 1 ? "text-rose-400" : "text-[var(--mut)]"}`}>{label}</span>
      </span>
    </div>
  );
}

/* ───────────── controles ───────────── */

function Popover({ open, onToggle, button, children, active = false, width }: {
  open: boolean; onToggle: () => void; button: ReactNode; children: ReactNode; active?: boolean; width: string;
}) {
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-expanded={open} onClick={onToggle}
        className={`inline-flex items-center gap-2 rounded-lg border bg-[var(--bg2)] px-3 py-2 text-sm transition ${open || active ? "border-[var(--acc)] text-[var(--tx)]" : "border-[var(--bd)] text-[var(--mut)] hover:border-[var(--acc)] hover:text-[var(--tx)]"}`}>
        {button}
      </button>
      {open && (
        <div className={`absolute right-0 z-30 mt-1.5 ${width} max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--bd)] bg-[var(--bg2)] p-1.5 shadow-xl shadow-black/30`}>
          {children}
        </div>
      )}
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[var(--acc)] px-1 text-[10px] font-semibold text-white">{children}</span>;
}

function CheckRow({ label, checked, onChange, disabled = false, count, icon }: {
  label: string; checked: boolean; onChange: () => void; disabled?: boolean; count?: number; icon?: ReactNode;
}) {
  return (
    <button type="button" role="menuitemcheckbox" aria-checked={checked} disabled={disabled} onClick={onChange}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50">
      <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition ${checked ? "border-[var(--acc)] bg-[var(--acc)] text-white" : "border-[var(--bd)]"}`}>
        {checked && <Check size={11} strokeWidth={3} />}
      </span>
      {icon}
      <span className="min-w-0 flex-1 truncate" title={label}>{label}</span>
      {count != null && <span className="font-mono text-[11px] text-[var(--mut)]">{count.toLocaleString("es-CO")}</span>}
    </button>
  );
}

function FilterPanel({ facets, statuses, countries, filingCountries, classNums, onlyImages, withImages, onStatus, onCountry, onFilingCountry, onClass, onImages, onClear }: {
  facets: CarteraMarksPage["facets"]; statuses: string[]; countries: string[]; filingCountries: string[]; classNums: number[]; onlyImages: boolean; withImages: number;
  onStatus: (v: string) => void; onCountry: (v: string) => void; onFilingCountry: (v: string) => void; onClass: (v: number) => void;
  onImages: (v: boolean) => void; onClear: () => void;
}) {
  if (!facets) return <div className="p-3 text-xs text-[var(--mut)]">Cargando filtros…</div>;
  return (
    <div className="max-h-[70vh] overflow-y-auto">
      <Section title="Estado">
        {facets.statuses.map((f) => <CheckRow key={f.value} label={f.value} count={f.count} checked={statuses.includes(f.value)} onChange={() => onStatus(f.value)} />)}
      </Section>
      {facets.filingCountries.length > 1 && (
        <Section title="País radicado">
          <CountryList facets={facets.filingCountries} selected={filingCountries} onToggle={onFilingCountry} />
        </Section>
      )}
      {facets.countries.length > 1 && (
        <Section title="País titular">
          <CountryList facets={facets.countries} selected={countries} onToggle={onCountry} />
        </Section>
      )}
      {facets.classes.length > 0 && (
        <Section title="Clase Niza">
          <div className="grid grid-cols-8 gap-1 px-2 pb-1">
            {facets.classes.map((f) => {
              const n = Number(f.value), on = classNums.includes(n);
              return (
                <button key={n} type="button" onClick={() => onClass(n)} title={`${f.count.toLocaleString("es-CO")} marcas`} aria-pressed={on}
                  className={`rounded-md border py-1 font-mono text-[11px] transition ${on ? "border-[var(--acc)] bg-[var(--acc)] text-white" : "border-[var(--bd)] text-[var(--mut)] hover:border-[var(--acc)] hover:text-[var(--tx)]"}`}>
                  {n}
                </button>
              );
            })}
          </div>
        </Section>
      )}
      {withImages > 0 && (
        <Section title="Imagen">
          <CheckRow label="Solo con imagen" count={withImages} checked={onlyImages} onChange={() => onImages(!onlyImages)} />
        </Section>
      )}
      <div className="border-t border-[var(--bd)] px-2 pt-1.5">
        <button type="button" onClick={onClear} className="w-full rounded-md px-2 py-1.5 text-left text-xs text-[var(--acc)] hover:bg-white/5">Limpiar filtros</button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-1.5">
      <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--mut)]">{title}</div>
      {children}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--acc)]/40 bg-[var(--acc)]/10 py-0.5 pl-2.5 pr-1 text-xs text-[var(--tx)]">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Quitar ${label}`} className="grid h-4 w-4 place-items-center rounded-full hover:bg-[var(--acc)]/25">
        <X size={11} />
      </button>
    </span>
  );
}

function Pager({ page, pages, disabled, onPage }: { page: number; pages: number; disabled: boolean; onPage: (p: number) => void }) {
  const items: (number | "…")[] = [];
  const win = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...win].sort((a, b) => a - b);
  sorted.forEach((p, i) => { if (i && p - sorted[i - 1] > 1) items.push("…"); items.push(p); });
  const btn = "grid h-7 min-w-7 place-items-center rounded-md px-1.5 transition disabled:opacity-40";
  return (
    <nav className="flex items-center gap-1" aria-label="Paginación">
      <button type="button" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)} className={`${btn} gap-1 hover:text-[var(--tx)]`}>
        <ChevronLeft size={14} />
      </button>
      {items.map((it, i) => it === "…"
        ? <span key={`e${i}`} className="px-1">…</span>
        : <button key={it} type="button" disabled={disabled} onClick={() => onPage(it)} aria-current={it === page ? "page" : undefined}
            className={`${btn} font-mono text-[11px] ${it === page ? "bg-[var(--acc)] text-white" : "hover:bg-white/5 hover:text-[var(--tx)]"}`}>
            {String(it).padStart(2, "0")}
          </button>)}
      <button type="button" disabled={disabled || page >= pages} onClick={() => onPage(page + 1)} className={`${btn} hover:text-[var(--tx)]`}>
        <ChevronRight size={14} />
      </button>
    </nav>
  );
}

/* ───────────── utilidades ───────────── */

/** Fecha de la fuente: AAAA-MM-DD(…) o D/M/AAAA (formato colombiano). `null` si no se reconoce. */
export function parseDate(value: string): Date | null {
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  const d = dmy ? new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
    : /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** DD/MM/YYYY. */
export function fmtDate(value: string) {
  const d = parseDate(value);
  if (!d) return value;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function hue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
