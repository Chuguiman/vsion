/**
 * Detección de mismo titular / mismo apoderado.
 * Si el solicitante de la gaceta es el mismo titular de la marca del cliente,
 * NO es un caso de confusión: es la propia marca del cliente publicándose
 * ("aviso de publicación"). No se opone ni se analiza con IA.
 *
 * Regla conservadora: solo se declara "mismo dueño" con igualdad normalizada
 * o contención multi-palabra. NO se usa similitud difusa: un falso positivo
 * ocultaría una oposición real (p.ej. FIBRATECH vs VIBRATECH son distintos).
 */
import { normalize } from "./phonetics";

// Formas jurídicas y conectores a eliminar antes de comparar.
const LEGAL = new Set([
  "SAS", "SA", "LTDA", "LIMITADA", "EU", "SENC", "SCA", "CIA", "COMPANIA",
  "COMPANY", "INC", "INCORPORATED", "CORP", "CORPORATION", "LLC", "LLP",
  "GMBH", "AG", "SL", "SRL", "BV", "NV", "PLC", "AND", "Y", "THE", "DE",
]);

/** Une secuencias de tokens de una sola letra: ["C","I"] → "CI", ["S","A"] → "SA" */
function mergeSingles(tokens: string[]): string[] {
  const out: string[] = [];
  let run = "";
  for (const t of tokens) {
    if (t.length === 1) { run += t; continue; }
    if (run) { out.push(run); run = ""; }
    out.push(t);
  }
  if (run) out.push(run);
  return out;
}

/** Normaliza un nombre de titular/empresa para comparar */
export function normalizeOwner(raw: string): string {
  if (!raw) return "";
  let s = raw.split(",")[0]; // el nombre va antes de la dirección
  s = normalize(s).toUpperCase();
  s = s.replace(/[.\-&/']/g, " ").replace(/[^A-Z0-9\s]/g, " ");
  const tokens = mergeSingles(s.split(/\s+/).filter(Boolean)).filter((t) => !LEGAL.has(t));
  return tokens.join(" ").trim();
}

/** ¿Dos nombres refieren a la misma persona/empresa? (conservador) */
export function sameEntity(a: string, b: string): boolean {
  const na = normalizeOwner(a);
  const nb = normalizeOwner(b);
  if (!na || !nb || na.length < 3 || nb.length < 3) return false;
  if (na === nb) return true;
  // Contención solo si el nombre corto es multi-palabra (evita coincidencias
  // casuales de una sola palabra genérica como "GLOBAL" o "GRUPO").
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (short.includes(" ") && short.length >= 6 && long.includes(short)) return true;
  return false;
}
