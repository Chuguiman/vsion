/**
 * Identidad fonética en español, inglés, portugués y francés: ¿una persona que
 * lee la marca en voz alta podría decir exactamente lo mismo que la otra?
 *
 * Cada marca produce varias LECTURAS por idioma (clave fonética):
 *  - literal: como se escribe (conserva vocales: CONTI ≠ CANTO).
 *  - deletreada (ES): siglas y números se leen por su nombre → PK2 = "pe-ka-dos" = PECADOS.
 *  - trampas (ES): números/símbolos como letras → KOL1N@ = KOLINA.
 * Reglas del español: H muda (pero CH sonora), QU/K/C(a,o,u) = K, B = V, G(e,i) = J,
 * S = Z = C(e,i), LL = Y. Se compara el núcleo distintivo (sin genéricos) y la marca completa.
 */
import { distinctiveWords } from "./generic-words";
import { phoneticTraps } from "./phonetics";

export type Lang = "es" | "en" | "pt" | "fr";
export const LANG_LABEL: Record<Lang, string> = { es: "español", en: "inglés", pt: "portugués", fr: "francés" };
const LANGS: Lang[] = ["es", "en", "pt", "fr"];

type Rule = [RegExp, string];
const apply = (t: string, rules: Rule[]) => rules.reduce((s, [p, r]) => s.replace(p, r), t);
const V = "aeiou";
const isCons = (ch: string) => !!ch && /[a-zçñʧʃʒ]/.test(ch) && !V.includes(ch);

/** minúsculas, sin tildes (conserva ç/ñ), solo letras */
function prep(text: string): string {
  return text.toLowerCase()
    .replace(/ü/g, "w") // la diéresis suena: PINGÜINO = "pingwino", CIGÜEÑA = "sigweña"
    .replace(/ç/g, "§").replace(/ñ/g, "¤")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/§/g, "ç").replace(/¤/g, "ñ")
    .replace(/[^a-zçñ]/g, "");
}
const dedupe = (t: string) => t.replace(/(.)\1+/g, "$1");

const ES: Rule[] = [
  [/ph/g, "f"], [/ll/g, "y"], [/[cs]h/g, "ʧ"], [/ñ/g, "ni"], [/ç/g, "s"],
  [/qu([ei])/g, "k$1"], [/q/g, "k"], [/g([ei])/g, "j$1"], [/gu([ei])/g, "g$1"], // GE = GI = J
  [/c([ei])/g, "s$1"], [/c/g, "k"], [/z/g, "s"], [/v/g, "b"],
  // W = GU = HU ante vocal: WHAT = GUAT, HUEVO = WEBO; "u" ante vocal es semivocal: KUIN = kwin (QUEEN)
  [/wh/g, "w"], [/hu(?=[aeio])/g, "w"], [/^gu(?=[ao])/, "w"], [/u(?=[aeio])/g, "w"], [/h/g, ""],
  [/y/g, "i"], [/^x/, "s"], [/x/g, "ks"], // XILABA = silaba; TAXI = taksi (y lectura alterna con "s": -XIÓN = -SIÓN)
];

const EN: Rule[] = [
  [/^[kgp]n/, "n"], [/^wr/, "r"],
  [/ç/g, "s"], [/ñ/g, "ni"], [/ph/g, "f"], [/igh/g, "ai"], [/gh/g, ""], [/ck/g, "k"], [/sh/g, "ʃ"], [/ch/g, "ʧ"], [/th/g, "t"],
  [/qu/g, "kw"], [/q/g, "k"], [/c([eiy])/g, "s$1"], [/c/g, "k"], [/x/g, "ks"], [/z/g, "s"],
  [/g([eiy])/g, "j$1"], [/wh/g, "w"], [/h/g, ""],
  // "e" muda final: NIKE → naik, CAKE → keik, PHONE → fon (como lo transcribe un hispanohablante)
  [/i([^aeiou])e$/, "ai$1"], [/a([^aeiou])e$/, "ei$1"], [/o([^aeiou])e$/, "o$1"], [/u([^aeiou])e$/, "iu$1"],
  [/(ee|ea|ie|ey)/g, "i"], [/(oo|ou)(?!$)/g, "u"], [/oa/g, "o"], [/ay$/g, "ei"], [/y/g, "i"],
];

const PT: Rule[] = [
  [/ph/g, "f"], [/lh/g, "li"], [/nh/g, "ni"], [/ñ/g, "ni"], [/ch/g, "ʃ"], [/ç/g, "s"],
  [/qu([ei])/g, "k$1"], [/q/g, "k"], [/g([ei])/g, "ʒ$1"], [/gu([ei])/g, "g$1"], [/j/g, "ʒ"],
  [/c([ei])/g, "s$1"], [/c/g, "k"], [/ss/g, "s"], [/(?<=[aeiou])s(?=[aeiou])/g, "z"], [/z$/g, "s"],
  [/x/g, "ʃ"], [/h/g, ""], [/w/g, "v"], [/y/g, "i"], [/ao$/g, "aun"], [/m$/g, "n"],
];

// Francés conservador: sin borrar consonantes finales (evita AURA = HORAS).
const FR: Rule[] = [
  [/ç/g, "s"], [/ñ/g, "ni"], [/ph/g, "f"], [/eau/g, "o"], [/au/g, "o"], [/ou/g, "u"], [/o[iy]/g, "ua"],
  [/[cs]h/g, "ʃ"], [/qu/g, "k"], [/q/g, "k"], [/gn/g, "ni"], [/g([eiy])/g, "ʒ$1"], [/gu([eiy])/g, "g$1"],
  [/c([eiy])/g, "s$1"], [/c/g, "k"], [/j/g, "ʒ"],
  [/(?<=[aeiouy])s(?=[aeiouy])/g, "z"], [/ss/g, "s"], [/h/g, ""], [/w/g, "v"], [/y/g, "i"],
];

const RULES: Record<Lang, Rule[]> = { es: ES, en: EN, pt: PT, fr: FR };

/** Clave fonética: se lee palabra por palabra (C HORIZON ≠ CHORIZÓN) y luego se une. */
export function langKey(text: string, lang: Lang): string {
  return dedupe(text.split(/\s+/).map((w) => apply(prep(w), RULES[lang])).join(""));
}

// ── Lectura deletreada en español ─────────────────────────────────────────────
const LETTER_ES: Record<string, string> = {
  a: "a", b: "be", c: "ce", d: "de", e: "e", f: "efe", g: "ge", h: "hache", i: "i", j: "jota", k: "ka",
  l: "ele", m: "eme", n: "ene", ñ: "eñe", o: "o", p: "pe", q: "cu", r: "erre", s: "ese", t: "te", u: "u",
  v: "ve", w: "dobleve", x: "equis", y: "ye", z: "zeta",
};
const UNITS = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
  "once", "doce", "trece", "catorce", "quince", "dieciseis", "diecisiete", "dieciocho", "diecinueve", "veinte",
  "veintiuno", "veintidos", "veintitres", "veinticuatro", "veinticinco", "veintiseis", "veintisiete", "veintiocho", "veintinueve"];
const TENS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
function numberEs(n: string): string {
  const v = Number(n);
  if (n.length > 2 || n.startsWith("0") && n.length > 1) return [...n].map((d) => UNITS[+d]).join(""); // 2019 → dos-cero-uno-nueve
  if (v < 30) return UNITS[v];
  return TENS[Math.floor(v / 10)] + (v % 10 ? "i" + UNITS[v % 10] : "");
}

// Nombres alternativos con que la gente dice la letra (Q = "cu" o "ke").
const LETTER_ALT: Record<string, string[]> = { q: ["cu", "ke"], v: ["ve", "uve"], w: ["dobleve", "dobleu"], y: ["ye", "i"], r: ["erre", "ere"] };
const spellLetter = (ch: string) => LETTER_ALT[ch] ?? [LETTER_ES[ch] ?? ch];
// Consonantes en que puede terminar una sílaba en español; otra cosa al final se deletrea.
const CODA = "dlnrszjyx";

/**
 * Lee como una persona (puede dar varias lecturas):
 *  - números → palabras (PK2 → "pe ka dos");
 *  - palabras sin vocal (siglas) → letra por letra (CSR → "ce ese erre");
 *  - grupos de consonantes impronunciables al final → deletreados (PANQK → "pan ke ka" = PANQUECA).
 */
function spelledEs(text: string): string[] {
  const tokens = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9ñ]+/).filter(Boolean);
  let changed = false;
  let outs = [""];
  const push = (alts: string[]) => { outs = outs.flatMap((p) => alts.map((a) => p + a)).slice(0, 8); };
  for (const tok of tokens) {
    const hasVowel = /[aeiouy]/.test(tok.replace(/\d/g, ""));
    for (const m of tok.match(/\d+|[a-zñ]+/g) ?? []) {
      if (/\d/.test(m)) { changed = true; push([numberEs(m)]); continue; }
      if (!hasVowel) { changed = true; for (const ch of m) push(spellLetter(ch)); continue; }
      // final impronunciable: ≥2 consonantes, o 1 consonante que no es coda posible (PANQK → pan + q + k)
      const tail = m.match(/[^aeiouy]+$/)?.[0] ?? "";
      const keep = tail.length >= 2 && CODA.includes(tail[0]) ? 1 : 0; // PANQK: "n" se queda en "pan"
      const odd = tail.slice(keep);
      // solo si de verdad no se puede pronunciar: ≥2 consonantes (PANQK) o final en Q/W/V/K sueltas
      if (odd && tail.length < m.length && (odd.length >= 2 || "qwv".includes(odd))) {
        changed = true;
        push([m.slice(0, m.length - tail.length + keep)]);
        for (const ch of tail.slice(keep)) push(spellLetter(ch));
      } else push([m]);
    }
    push([" "]);
  }
  return changed ? outs.map((o) => o.trim()) : [];
}

// ── Trampas: números/símbolos usados como letras (varias lecturas posibles) ──
const TRAPS: Record<string, string[]> = {
  "0": ["o"], "1": ["i", "l"], "2": ["z"], "3": ["e"], "4": ["a"], "5": ["s"], "6": ["g"], "7": ["t"], "8": ["b"], "9": ["g"],
  "@": ["a", "o"], "$": ["s"], "€": ["e"], "!": ["i"], "|": ["l", "i"], "+": ["t"], "&": ["y", "e"], "¢": ["c"], "£": ["l"],
};
const TRAP_RE = /[0-9@$€!|+&¢£]/;
const MAX_TRAP_VARIANTS = 16;
/** TOD@S → [todas, todos]; KOL1N@ → [kolina, kolino, kollna…]; 0SO → [oso]. */
function trapVariants(text: string): string[] {
  let out = [""];
  for (const ch of text.toLowerCase()) {
    const alts = TRAPS[ch] ?? [ch];
    out = out.flatMap((p) => alts.map((a) => p + a)).slice(0, MAX_TRAP_VARIANTS);
  }
  return out;
}

/** Todas las lecturas (claves) de un texto por idioma. */
function readingsOf(text: string): Record<Lang, Set<string>> {
  const r = Object.fromEntries(LANGS.map((l) => [l, new Set<string>()])) as Record<Lang, Set<string>>;
  for (const l of LANGS) r[l].add(langKey(text, l));
  for (const s of spelledEs(text)) r.es.add(langKey(s, "es"));
  if (/x/i.test(text)) r.es.add(langKey(text.replace(/x/gi, "s"), "es")); // X suave: CONEXIÓN = conesión
  if (TRAP_RE.test(text)) {
    r.es.add(langKey(phoneticTraps(text), "es")); // números largos en palabras: 100 → cien
    for (const t of trapVariants(text)) for (const l of LANGS) r[l].add(langKey(t, l)); // TOD@S → todas/todos
  }
  return r;
}

/** Núcleo distintivo; si todo es genérico, la marca completa. */
function core(text: string): string {
  return distinctiveWords(text).join(" ") || text;
}

type Keys = Record<Lang, Set<string>>;
const cache = new Map<string, Keys>();
function keysOf(text: string): Keys {
  let k = cache.get(text);
  if (!k) {
    const c = readingsOf(core(text)), f = readingsOf(text);
    // Mínimo de sonidos: ES 2 (KE = QUE), EN 3 (COOL = kul), PT/FR 4 (siglas cortas generan ruido: OYH ≈ O´YA).
    const min: Record<Lang, number> = { es: 2, en: 3, pt: 4, fr: 4 };
    k = Object.fromEntries(LANGS.map((l) => [l, new Set([...c[l], ...f[l]].filter((x) => valid(x) && x.length >= min[l]))])) as Keys;
    if (cache.size > 50_000) cache.clear();
    cache.set(text, k);
  }
  return k;
}

const valid = (k: string) => k.length >= 2 && [...k].some((ch) => V.includes(ch));

// Grupos iniciales pronunciables en ES/PT; cualquier otro (KS-, TS-, MS-…) obliga a
// intercalar una vocal al leerlo: KSA se dice "kasa" → suena como CASA/KASA/KAZA.
const VALID_ONSET = new Set(["pl", "pr", "bl", "br", "fl", "fr", "tr", "dr", "kl", "kr", "gl", "gr", "tl"]);
function vowelOmitted(short: string, long: string): boolean {
  if (long.length !== short.length + 1 || !isCons(short[0]) || !isCons(short[1])) return false;
  // E protética del español ante S + consonante: SMILE ("smail") = ESMAIL, STAR = ESTAR
  if (short[0] === "s" && long === "e" + short) return true;
  if (VALID_ONSET.has(short.slice(0, 2))) return false;
  // vocal intercalada natural: A/E (K → "ka", S → "ese")
  return "ae".includes(long[1]) && long[0] === short[0] && long.slice(2) === short.slice(1);
}
const vowelVariants = (key: string) => {
  if (!isCons(key[0]) || !isCons(key[1]) || VALID_ONSET.has(key.slice(0, 2))) return [];
  const out = [...V.slice(0, 2)].map((v) => key[0] + v + key.slice(1));
  if (key[0] === "s") out.push("e" + key);
  return out;
};

// ── Confusiones frecuentes (nivel 2: "puede confundirse", no idéntica) ───────
// R ↔ L (CARRO dicho "calo" por hablantes de chino/japonés/inglés) y la R/L que se
// pierde tras consonante (FREIJOA = FEIJOA, BRUMA ≈ BUMA). Clave "floja": r→l y
// sin la líquida de los grupos consonánticos.
const looseKey = (k: string) => dedupe(k.replace(/r/g, "l").replace(/(?<=[^aeiouʧ])l/g, ""));

/** Qué confusión explica el parecido (si no son idénticas), o null. */
export function phoneticConfusion(a: string, b: string): string | null {
  const ka = keysOf(a), kb = keysOf(b);
  const la = new Map<string, string>();
  for (const l of LANGS) for (const x of ka[l]) if (x.length >= 3) la.set(looseKey(x), x);
  for (const l of LANGS) for (const y of kb[l]) {
    const x = y.length >= 3 ? la.get(looseKey(y)) : undefined;
    if (!x || x === y) continue;
    const rl = x.replace(/r/g, "l") === y.replace(/r/g, "l");
    return rl ? `confusión R/L ("${x}" ≈ "${y}")` : `R/L que se pierde tras consonante ("${x}" ≈ "${y}")`;
  }
  return null;
}

/**
 * Claves para indexar en el barrido (sin idioma: permite cruces COOL [en] = KUL [es]).
 * Dos marcas que pueden sonar idénticas comparten al menos una.
 */
export function phoneticIndexKeys(text: string): string[] {
  const k = keysOf(text), out = new Set<string>();
  for (const l of LANGS) for (const key of k[l]) {
    out.add(key);
    for (const v of vowelVariants(key)) out.add(v); // la lee un hispano/lusohablante
    if (key.length >= 3) out.add("~" + looseKey(key)); // confusiones R/L
  }
  return [...out];
}

interface Match { la: Lang; lb: Lang; reading: string }

/**
 * Busca una lectura común: cada marca leída en cualquiera de los 4 idiomas,
 * incluso cruzados (COOL leída en inglés = KUL/CUL leídas en español).
 */
function findMatch(a: string, b: string): Match | null {
  const ka = keysOf(a), kb = keysOf(b);
  let best: Match | null = null;
  for (const la of LANGS) for (const x of ka[la]) for (const lb of LANGS) for (const y of kb[lb]) {
    const vowel = (la === "es" || la === "pt") && vowelOmitted(y, x) || (lb === "es" || lb === "pt") && vowelOmitted(x, y);
    if (x !== y && !vowel) continue;
    const m = { la, lb, reading: x.length >= y.length ? x : y };
    if (la === lb) return m; // preferir la coincidencia dentro del mismo idioma
    best ??= m;
  }
  return best;
}

/** Idiomas en los que las dos marcas pueden sonar idénticas (vacío si en ninguno). */
export function phoneticallyIdentical(a: string, b: string): Lang[] {
  const ka = keysOf(a), kb = keysOf(b);
  const same = LANGS.filter((l) => {
    for (const x of ka[l]) for (const y of kb[l]) {
      if (x === y) return true;
      if ((l === "es" || l === "pt") && (vowelOmitted(x, y) || vowelOmitted(y, x))) return true;
    }
    return false;
  });
  if (same.length) return same;
  const m = findMatch(a, b); // cruce entre idiomas
  return m ? [...new Set([m.la, m.lb])] : [];
}

/** Explicación legible: 'inglés → español: "kul"' o 'español: "pekados"'. */
export function sharedReading(a: string, b: string): string | null {
  const m = findMatch(a, b);
  if (!m) return null;
  return m.la === m.lb ? `"${m.reading}"` : `"${m.reading}" (${LANG_LABEL[m.la]} ↔ ${LANG_LABEL[m.lb]})`;
}
