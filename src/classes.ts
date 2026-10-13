/**
 * Mapa de clases Niza relacionadas — tabla de la firma (Brevio · SAMAI, exportada
 * 2026-10-13). Se consulta simétrica: si A→B, también B→A.
 */
const RAW: Record<number, number[]> = {
  1: [2, 5], 2: [1, 4, 40], 3: [5, 18, 21, 25], 4: [2], 5: [1, 3, 10], 6: [8, 17, 19, 37],
  7: [8, 9, 12, 37], 8: [6, 7], 9: [7, 11, 15, 38], 10: [1, 5], 11: [7, 9, 37], 12: [7, 39],
  13: [], 14: [9, 25], 15: [9], 16: [38, 41], 17: [19, 20, 37], 18: [3, 25, 28], 19: [6, 17, 20, 37],
  20: [17], 21: [3, 19], 22: [23, 24, 25, 26, 27], 23: [22, 24, 25, 26, 27], 24: [22, 23, 25, 26, 27],
  25: [3, 18, 22, 23, 24, 26, 27], 26: [22, 23, 24, 25, 27], 27: [22, 23, 24, 25, 26], 28: [18],
  29: [30, 31, 32], 30: [29, 31], 31: [29, 30, 32, 43], 32: [29, 31, 33, 43], 33: [32], 34: [],
  35: [42], 36: [19, 37], 37: [7, 11, 17, 19, 36], 38: [9], 39: [12], 40: [2], 41: [16],
  42: [35, 43, 44, 45], 43: [42], 44: [42], 45: [42],
};

/** Título corto de cada clase Niza (para que la IA y el revisor lean el sector). */
const TITLES: Record<number, string> = {
  1: "productos químicos, agroquímicos, abonos", 2: "pinturas, barnices, colorantes", 3: "cosméticos, perfumería, aseo",
  4: "aceites industriales, combustibles, velas", 5: "farmacéuticos, veterinarios, suplementos, plaguicidas",
  6: "metales comunes, ferretería metálica", 7: "máquinas y motores", 8: "herramientas de mano, cubertería",
  9: "aparatos científicos, electrónica, software", 10: "aparatos médicos y veterinarios", 11: "iluminación, calefacción, sanitarios",
  12: "vehículos", 13: "armas de fuego, pirotecnia", 14: "joyería, relojería", 15: "instrumentos musicales",
  16: "papelería, impresos", 17: "caucho, plásticos semielaborados, aislantes", 18: "cuero, marroquinería, maletas",
  19: "materiales de construcción no metálicos", 20: "muebles, espejos", 21: "utensilios de cocina y hogar, vidrio",
  22: "cuerdas, lonas, sacos", 23: "hilos", 24: "tejidos, ropa de cama", 25: "vestuario, calzado, sombrerería",
  26: "mercería, encajes", 27: "alfombras, revestimientos de suelo", 28: "juegos, juguetes, artículos deportivos",
  29: "carne, lácteos, conservas, alimentos procesados", 30: "café, harinas, panadería, confitería, condimentos",
  31: "productos agrícolas frescos, semillas, alimento animal", 32: "cervezas, bebidas sin alcohol", 33: "bebidas alcohólicas",
  34: "tabaco", 35: "publicidad, gestión de negocios, venta minorista", 36: "seguros, finanzas, inmobiliaria",
  37: "construcción, reparación, instalación", 38: "telecomunicaciones", 39: "transporte, logística, viajes",
  40: "tratamiento de materiales, fabricación a medida", 41: "educación, formación, entretenimiento, deportes",
  42: "servicios científicos, tecnológicos, software", 43: "restaurantes, cafeterías, hospedaje",
  44: "servicios médicos, veterinarios, belleza, agricultura", 45: "servicios jurídicos, seguridad, personales",
};
export function niceTitle(n: number): string { return TITLES[n] ?? "clase " + n; }

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
