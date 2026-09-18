# vsion

Comparador de marcas standalone. Barre una gaceta contra la cartera de marcas del
cliente en tres etapas, sin depender de PHP ni de base de datos:

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
