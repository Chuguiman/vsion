/**
 * Mapa de clases Niza relacionadas (conexión competitiva típica).
 * Simétrico: si A→B, se asume B→A al consultar. Ajustable.
 * Basado en prácticas comunes de examen de confundibilidad.
 */
const RAW: Record<number, number[]> = {
  3: [5, 21, 44],        // cosmética ↔ farma, utensilios de aseo, servicios de belleza
  5: [3, 10, 29, 30, 35, 44], // farma ↔ cosmética, aparatos médicos, alimentos, retail farma, salud
  9: [38, 42],           // aparatos/software ↔ telecom, servicios TI
  16: [35, 41],          // papelería/impresos ↔ publicidad, educación
  18: [25, 35],          // cuero/marroquinería ↔ vestuario, retail moda
  25: [18, 35],          // vestuario ↔ marroquinería, retail moda
  29: [30, 31, 32, 35, 43], // alimentos ↔ alimentos, agrícolas, bebidas, retail, restaurantes
  30: [29, 31, 32, 35, 43],
  31: [29, 30, 44],      // agrícolas ↔ alimentos, servicios agrícolas
  32: [29, 30, 33, 35, 43], // bebidas ↔ alimentos, bebidas alcohólicas, retail, restaurantes
  33: [32, 35, 43],      // bebidas alcohólicas
  35: [16, 18, 25, 29, 30, 32, 36, 38, 41, 42], // publicidad/retail ↔ muchas
  36: [35, 37],          // seguros/finanzas ↔ negocios, construcción (inmobiliaria)
  37: [36, 42],          // construcción ↔ inmobiliaria, ingeniería
  38: [9, 35, 41, 42],   // telecom ↔ aparatos, negocios, entretenimiento, TI
  41: [16, 35, 38, 42],  // educación/entretenimiento
  42: [9, 35, 37, 38, 44], // servicios TI/científicos ↔ software, negocios, ingeniería, telecom, salud
  43: [29, 30, 32, 33],  // restaurantes/hospedaje ↔ alimentos y bebidas
  44: [3, 5, 31, 42],    // salud/belleza/agrícolas
};

const MAP = new Map<number, Set<number>>();
for (const [k, v] of Object.entries(RAW)) {
  const key = Number(k);
  if (!MAP.has(key)) MAP.set(key, new Set());
  for (const r of v) {
    MAP.get(key)!.add(r);
    if (!MAP.has(r)) MAP.set(r, new Set());
    MAP.get(r)!.add(key); // simétrico
  }
}

export function classOverlap(a: number[], b: number[]): { matching: number[]; related: number[] } {
  const bSet = new Set(b);
  const matching = a.filter((c) => bSet.has(c));
  const matchSet = new Set(matching);
  const related = new Set<number>();
  for (const ca of a) {
    const rels = MAP.get(ca);
    if (!rels) continue;
    for (const cb of b) if (rels.has(cb) && !matchSet.has(cb)) related.add(cb);
  }
  return { matching, related: [...related].sort((x, y) => x - y) };
}
