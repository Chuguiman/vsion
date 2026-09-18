# vsion

Comparador de marcas. App web (Next.js) **y** CLI. Barre una gaceta contra la
cartera del cliente sin depender de PHP.

## App web (Fase 1)

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

- `/` — sube cartera (casos.json) + gaceta (CO####.json), corre el barrido y muestra
  el reporte web (filtros: Con conflicto / Aviso publicación / Todas; titular visible).
- `/historial` — corridas guardadas (requiere `DATABASE_URL`).
- Sin `DATABASE_URL` la app funciona igual pero no guarda historial.

### Deploy (Vercel + Supabase)

1. Crear proyecto Supabase → ejecutar `src/lib/schema.sql` en el SQL editor.
2. Copiar el connection string a `DATABASE_URL` (con `?sslmode=require`).
3. `git push` → importar el repo en Vercel → setear variables (`DATABASE_URL`,
   y en Fase 2 `OPENROUTER_API_KEY`).
4. Nota: la cartera pesa ~13MB; en Vercel el body de una petición se limita a
   ~4.5MB. En producción la subida de la cartera se hará vía Supabase Storage
   (pendiente) o importándola una sola vez. El barrido y el historial ya están.

---

## Motor / CLI

Tres etapas, todo en Node/TS, sin BD:

1. **Barrido fonético/textual** (Node puro, en memoria, <1 s) — reduce millones de
   pares a unos cientos de candidatos mediante índice invertido de trigramas + soundex.
2. **Revisión IA** (OpenRouter) — un agente revisa cada candidato como un abogado de
   marcas y emite veredicto: `Oponerse` / `Vigilar` / `Sin acción`.
3. **Reporte** — HTML autocontenido (imprimible a PDF) + XLSX.

## Uso

```bash
pnpm install
cp .env.example .env          # añade tu OPENROUTER_API_KEY

# comparación completa (barrido + IA)
pnpm compare -- <casos.json> <gaceta.json>

# solo barrido, sin IA (instantáneo, para calibrar)
pnpm sweep -- <casos.json> <gaceta.json>
```

Ejemplo:

```bash
pnpm compare -- "C:/Users/granj/OneDrive/Escritorio/casos.json" "C:/Herd/procesaGacetas/paises_origen/sipi_sic_co/CO1113.json"
```

Salida en `out/CO####-report.html` y `out/CO####-report.xlsx`.

## Opciones

| Flag | Def | Descripción |
|------|-----|-------------|
| `--no-ai` | | Solo Etapa 1 (barrido) |
| `--ai-all` | | Manda todos los candidatos a la IA (por defecto pre-filtra por clase/score) |
| `--threshold <n>` | 55 | Score mínimo del barrido (0-100) |
| `--topn <n>` | 15 | Máx candidatos por publicación |
| `--concurrency <n>` | 8 | Llamadas IA en paralelo (baja a 4-6 si hay rate-limit) |
| `--model <id>` | env | Modelo OpenRouter |
| `--out <dir>` | out | Carpeta de salida |

## Cache de IA (importante)

Cada corrida guarda los veredictos en `out/CO####-ai-cache.json`. Si OpenRouter
rate-limitea y algunos candidatos fallan, **vuelve a correr el mismo comando**:
el cache reutiliza los ya resueltos (no se re-pagan) y solo reintenta los fallidos,
hasta converger a 0 fallos. Borra ese archivo si quieres re-analizar desde cero.

## Formatos de entrada

- **casos.json** — array de marcas del cliente. Campos: `caso_titulo` (denominación),
  `descripcion_de_productos_y_servicios` (clases Niza), `productos_y_servicios_descripcion`,
  `titular`, `estado_del_caso`, `numero_de_caso_codigo`.
- **gaceta CO####.json** — `{ publication: [meta], details: [...] }`. Cada detalle:
  `word` (denominación), `clases`, `pys[]`, `applicants[]`, `applicationNumber`, `markType`.

## Estructura

```
src/
  phonetics.ts    motor fonético (soundex, metaphone, español, trampas, n-gramas)
  similarity.ts   jaro-winkler, levenshtein, dice, contención
  classes.ts      mapa de clases Niza relacionadas
  load.ts         parseo de casos.json y gaceta
  sweep.ts        Etapa 1 — barrido con índice invertido
  ai-review.ts    Etapa 2 — agente IA (OpenRouter)
  report.ts       reporte HTML
  xls.ts          export XLSX
  cli.ts          orquestador
```

El motor fonético es un port de `samai-next/src/lib/expression-indexer.ts`.
