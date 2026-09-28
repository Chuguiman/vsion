/**
 * Términos genéricos / descriptivos del producto o del sector (ES + EN).
 * Compartir uno de ellos NO genera riesgo de confusión por sí solo: "EFRAN SHOES CO"
 * vs "BASICS SHOES" comparten SHOES (calzado, clase 25) pero lo distintivo
 * (EFRAN vs BASICS) es distinto → coexisten.
 */
import { normWords } from "./phonetics";
import { jaroWinkler, levenshteinRatio, wordContainment } from "./similarity";

export const GENERIC_WORDS = new Set([
  // forma societaria / relleno
  "co", "cia", "sas", "sa", "ltda", "inc", "llc", "corp", "group", "grupo", "company", "compania", "companía",
  "de", "del", "la", "las", "el", "los", "y", "e", "o", "en", "con", "por", "para", "al", "un", "una",
  "the", "of", "and", "for", "by", "to", "in", "on", "with", "my", "mi", "tu", "su",
  "internacional", "international", "global", "colombia", "col", "latam", "america", "world", "mundo",
  // laudatorias
  "nuevo", "nueva", "mejor", "best", "calidad", "quality", "siempre", "futuro", "premium", "plus", "pro", "top",
  "super", "mega", "master", "gold", "real", "royal", "original", "basic", "basics", "classic", "clasico",
  "express", "center", "centro", "club", "house", "casa", "home", "hogar", "zone", "zona", "life", "vida",
  "one", "uno", "first", "star", "estrella",
  // comercio
  "store", "shop", "tienda", "boutique", "market", "mercado", "outlet", "import", "imports", "importaciones",
  "distribuciones", "distribuidora", "comercializadora", "brand", "brands", "marca", "marcas", "official",
  // moda / calzado (25, 18, 14)
  "shoes", "shoe", "zapatos", "zapato", "calzado", "calzados", "sneakers", "boots", "botas", "sandals",
  "fashion", "moda", "modas", "style", "styles", "estilo", "wear", "clothing", "clothes", "ropa", "jeans",
  "boutique", "collection", "coleccion", "design", "designs", "diseno", "disenos", "studio", "estudio",
  "bags", "bolsos", "joyeria", "jewelry", "accesorios", "accessories", "kids", "baby", "bebe", "man", "men",
  "woman", "women", "mujer", "hombre", "lingerie", "lenceria", "sport", "sports", "deportes", "deportivo",
  // belleza / salud (3, 5, 10, 44)
  "beauty", "belleza", "spa", "nails", "unas", "hair", "cabello", "salon", "cosmetics", "cosmeticos",
  "skin", "care", "piel", "natural", "naturals", "organic", "organico", "pharma", "farma", "farmacia",
  "labs", "lab", "laboratorio", "laboratorios", "medical", "medica", "medico", "salud", "health", "clinic",
  "clinica", "dental", "odontologia", "wellness", "fitness", "gym", "vet", "pets", "pet", "mascotas",
  // alimentos / restaurantes (29, 30, 32, 33, 43)
  "food", "foods", "alimentos", "cafe", "coffee", "tea", "te", "pizza", "burger", "burgers", "grill",
  "bar", "restaurante", "restaurant", "kitchen", "cocina", "bakery", "panaderia", "pasteleria", "bebidas",
  "drinks", "beer", "cerveza", "water", "agua", "juice", "jugos", "snacks", "chicken", "pollo", "fruit",
  "frutas", "carnes", "meat", "helados", "ice", "cream", "chocolate", "gourmet", "delicias",
  // tecnología / servicios (9, 35, 36, 37, 38, 39, 41, 42)
  "tech", "technology", "tecnologia", "soft", "software", "digital", "online", "app", "apps", "data",
  "net", "web", "cloud", "smart", "solutions", "soluciones", "services", "servicios", "consulting",
  "consultores", "consultoria", "logistics", "logistica", "transport", "transportes", "construcciones",
  "constructora", "ingenieria", "engineering", "energy", "energia", "solar", "inmobiliaria", "capital",
  "finance", "financiera", "seguros", "travel", "viajes", "tours", "agencia", "agency", "media",
  "marketing", "academy", "academia", "school", "escuela", "educacion", "auto", "autos", "motors",
  "motos", "car", "cars", "agro", "industrial", "industrias",
  // frecuentes en descartes reales de revisión
  "corporacion", "fundacion", "asociacion", "central", "comercial", "colombiano", "colombiana", "productos",
  "transporte", "inversiones", "distribuidor", "drogueria", "droguerias", "lacteos", "empanadas", "asados",
  "hamburguesas", "sabor", "sabores", "innovation", "innovacion", "gestion", "seguridad", "alimentaria",
  "oral", "luxury",
]);

function tokens(text: string): string[] {
  return normWords(text).split(" ").filter(Boolean);
}

/** Palabras distintivas (ni genéricas ni de 1 letra). */
export function distinctiveWords(text: string): string[] {
  return tokens(text).filter((w) => w.length >= 2 && !GENERIC_WORDS.has(w));
}

/**
 * Si el parecido entre dos marcas se debe SOLO a términos genéricos compartidos
 * (p.ej. SHOES) y sus partes distintivas son claramente distintas, devuelve esos
 * términos; si no, null (el caso sigue a revisión IA/humana).
 */
export function genericOnlyOverlap(a: string, b: string): string[] | null {
  const ta = new Set(tokens(a)), tb = new Set(tokens(b));
  const sharedGeneric = [...ta].filter((w) => tb.has(w) && GENERIC_WORDS.has(w) && w.length >= 3);
  if (!sharedGeneric.length) return null;

  const da = distinctiveWords(a), db = distinctiveWords(b);
  if (!da.length || !db.length) return sharedGeneric; // una de las dos es solo genérica: signo débil
  if (da.some((w) => db.includes(w))) return null;     // comparten una palabra distintiva

  const ca = da.join(""), cb = db.join("");
  if (jaroWinkler(ca, cb) >= 0.85 || levenshteinRatio(ca, cb) >= 0.75) return null;
  if (wordContainment(ca, da.join(" "), cb, db.join(" "))) return null;
  // Cualquier par de palabras distintivas parecidas (EFRAN vs EFRAIN) → no es solo genérico
  for (const x of da) for (const y of db) {
    if (x.length >= 3 && y.length >= 3 && (jaroWinkler(x, y) >= 0.88 || levenshteinRatio(x, y) >= 0.8)) return null;
  }
  return sharedGeneric;
}
