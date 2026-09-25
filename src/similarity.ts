/**
 * Métricas de similitud textual. Todo O(n·m) o menos, sin dependencias.
 */

/** Jaro-Winkler 0..1 — bueno para similitud visual/tipográfica de nombres */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const matchDist = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);
  let matches = 0;

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true; bMatches[j] = true; matches++; break;
    }
  }
  if (matches === 0) return 0;

  let t = 0, k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  t /= 2;

  const m = matches;
  const jaro = (m / a.length + m / b.length + (m - t) / m) / 3;

  // Winkler: bonus por prefijo común (hasta 4)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++; else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

/** Distancia de Levenshtein */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Ratio de Levenshtein 0..1 */
export function levenshteinRatio(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/** Coeficiente de Dice sobre dos sets (n-gramas) 0..1 */
export function diceCoefficient(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  if (!a.size || !b.size) return 0;
  let inter = 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  for (const g of small) if (large.has(g)) inter++;
  return (2 * inter) / (a.size + b.size);
}

/**
 * Contención en límite de palabra: la marca corta (sin espacios) debe aparecer
 * en la larga empezando o terminando en un límite de palabra (puede abarcar
 * varias palabras). "COCACOLA" ⊂ "COCA COLA ZERO", "LEON" ⊂ "LEONA",
 * "ETEK" ⊂ "MALETEK" sí; "NAMA" ⊂ "CUNDINAMARCA" (a mitad de palabra) no.
 * @param aClean/bClean forma sin espacios; aWords/bWords forma con espacios.
 */
export function wordContainment(aClean: string, aWords: string, bClean: string, bWords: string): boolean {
  if (aClean.length < 4 || bClean.length < 4) return false;
  const [short, longWords] = aClean.length <= bClean.length ? [aClean, bWords] : [bClean, aWords];
  const words = longWords.split(" ").filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    if (words.slice(i).join("").startsWith(short)) return true;
    if (words.slice(0, i + 1).join("").endsWith(short)) return true;
  }
  return false;
}
