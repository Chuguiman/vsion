/**
 * Reporte HTML autocontenido. Imprimible a PDF (botón / Ctrl+P).
 */
import type { Candidate, GazetteMeta } from "./types";

const REC_LABEL: Record<string, string> = {
  file_opposition: "Oponerse",
  monitor_closely: "Vigilar",
  no_action: "Sin acción",
  own: "Tu marca (aviso)",
  firm: "Presentada por tu firma",
};
const REC_RANK: Record<string, number> = { file_opposition: 0, monitor_closely: 1, firm: 2, own: 3, no_action: 4 };

/** Categoría: mismo titular → tu marca; tu firma es apoderado → firm; si no, veredicto IA */
function rowKind(c: Candidate): string {
  if (c.sameOwner) return "own";
  if (c.sameAttorney) return "firm";
  return c.ai?.recommendation ?? "no_action";
}

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

interface Group {
  key: string;
  denom: string;
  applicationNumber: string;
  applicant: string;
  representant: string;
  markType: string;
  classes: number[];
  cands: Candidate[];
  topRank: number;
}

function groupByPublication(cands: Candidate[]): Group[] {
  const map = new Map<string, Group>();
  for (const c of cands) {
    const key = c.gazette.applicationNumber || c.gazette.denom;
    let g = map.get(key);
    if (!g) {
      g = {
        key, denom: c.gazette.denom, applicationNumber: c.gazette.applicationNumber,
        applicant: c.gazette.applicant, representant: c.gazette.representant, markType: c.gazette.markType,
        classes: c.gazette.classes, cands: [], topRank: 3,
      };
      map.set(key, g);
    }
    g.cands.push(c);
  }
  for (const g of map.values()) {
    g.cands.sort((a, b) => (REC_RANK[rowKind(a)] - REC_RANK[rowKind(b)]) || b.score - a.score);
    g.topRank = Math.min(...g.cands.map((c) => REC_RANK[rowKind(c)]));
  }
  return [...map.values()].sort((a, b) => a.topRank - b.topRank || b.cands[0].score - a.cands[0].score);
}

function badge(kind: string): string {
  return `<span class="badge ${kind}">${REC_LABEL[kind] ?? kind}</span>`;
}

function scoreColor(s: number): string {
  const t = Math.max(0, Math.min(1, (s - 55) / 45));
  return `hsl(${210 - 210 * t}, 78%, 58%)`;
}

function candRow(c: Candidate): string {
  const kind = rowKind(c);
  const matchSet = new Set(c.matchingClasses);
  const relSet = new Set(c.relatedClasses);
  const classes = c.client.classes.length
    ? c.client.classes.map((n) => {
        const cl = matchSet.has(n) ? "match" : relSet.has(n) ? "rel" : "other";
        return `<span class="cls ${cl}">${n}</span>`;
      }).join("")
    : '<span class="cls none">—</span>';
  const col = scoreColor(c.score);
  const holder = c.client.holder ? `<div class="sub owner">Titular: ${esc(c.client.holder)}</div>` : "";
  const verdict = kind === "own" || kind === "firm"
    ? badge(kind)
    : `${badge(kind)}${c.ai ? `<div class="prob">${c.ai.success_probability}%</div>` : ""}`;
  const analysis = kind === "own"
    ? "Solicitante = titular de tu marca. Es tu propia solicitud publicándose; no procede oposición, solo aviso."
    : kind === "firm"
    ? "La solicitud nueva la presentó tu propia firma (mismo apoderado) para otro titular. No es oposición externa; revisar internamente."
    : `${esc(c.ai?.summary || "")}${c.ai?.reasoning ? `<details><summary>razonamiento</summary><p>${esc(c.ai.reasoning)}</p></details>` : ""}`;
  return `
  <tr class="cand" data-rec="${kind}">
    <td class="score"><div class="bar"><i style="width:${c.score}%;background:${col}"></i></div><span style="color:${col};font-weight:600">${c.score}</span></td>
    <td class="denom">${esc(c.client.denom)}<div class="sub">${esc(c.client.code)} · ${esc(c.client.status)}</div>${holder}</td>
    <td class="cls-col">${classes}</td>
    <td>${verdict}</td>
    <td class="reason">${analysis}</td>
  </tr>`;
}

function groupBlock(g: Group): string {
  return `
  <section class="pub" data-toprank="${g.topRank}">
    <header>
      <h2>${esc(g.denom)}</h2>
      <div class="meta">
        <span>${esc(g.applicationNumber)}</span>
        <span>${esc(g.markType)}</span>
        <span>Clases: ${g.classes.join(", ") || "—"}</span>
        <span>Solicitante: ${esc(g.applicant) || "—"}</span>
        ${g.representant ? `<span>Apoderado gaceta: <span class="apo">${esc(g.representant)}</span></span>` : ""}
      </div>
    </header>
    <table>
      <thead><tr><th>Score</th><th>Marca del cliente</th><th>Clases</th><th>Veredicto</th><th>Análisis</th></tr></thead>
      <tbody>${g.cands.map(candRow).join("")}</tbody>
    </table>
  </section>`;
}

export function buildHtml(cands: Candidate[], meta: GazetteMeta, aiRan: boolean): string {
  const groups = groupByPublication(cands);
  const nOpp = cands.filter((c) => !c.sameOwner && c.ai?.recommendation === "file_opposition").length;
  const nMon = cands.filter((c) => !c.sameOwner && c.ai?.recommendation === "monitor_closely").length;
  const nOwn = cands.filter((c) => c.sameOwner).length;
  const pubsWithRisk = groups.filter((g) => g.topRank < 2).length;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>vsion — Gaceta ${esc(meta.country)}${esc(meta.number)}</title>
<style>
:root{--bg:#18181b;--bg2:#27272a;--bd:#3f3f46;--tx:#e4e4e7;--mut:#a1a1aa;--acc:#10b981;--red:#ef4444;--amb:#f59e0b}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);font:14px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:24px 16px 80px}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;border-bottom:1px solid var(--bd);padding-bottom:16px;margin-bottom:20px}
.top h1{margin:0;font-size:20px;letter-spacing:.5px}
.top .sub{color:var(--mut);font-size:12px;margin-top:4px}
.kpis{display:flex;gap:12px;flex-wrap:wrap}
.kpi{background:var(--bg2);border:1px solid var(--bd);border-radius:10px;padding:10px 14px;min-width:96px}
.kpi b{display:block;font-size:22px}
.kpi span{color:var(--mut);font-size:11px;text-transform:uppercase;letter-spacing:.5px}
.kpi.opp b{color:var(--red)} .kpi.mon b{color:var(--amb)} .kpi.own b{color:#93c5fd}
.controls{display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap}
.controls button{background:var(--bg2);border:1px solid var(--bd);color:var(--tx);padding:7px 12px;border-radius:8px;cursor:pointer;font-size:13px}
.controls button.active{border-color:var(--acc);color:var(--acc)}
.controls .spacer{flex:1}
.pub{background:var(--bg2);border:1px solid var(--bd);border-radius:12px;margin-bottom:16px;overflow:hidden}
.pub header{padding:12px 16px;border-bottom:1px solid var(--bd)}
.pub h2{margin:0;font-size:16px}
.pub .meta{display:flex;gap:14px;flex-wrap:wrap;color:var(--mut);font-size:12px;margin-top:4px}
table{width:100%;border-collapse:collapse}
th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--mut);padding:8px 16px;border-bottom:1px solid var(--bd)}
td{padding:10px 16px;border-bottom:1px solid var(--bd);vertical-align:top}
tr:last-child td{border-bottom:none}
.score{white-space:nowrap;width:90px}
.score .bar{display:inline-block;width:48px;height:6px;background:var(--bd);border-radius:3px;overflow:hidden;vertical-align:middle;margin-right:6px}
.score .bar i{display:block;height:100%;background:var(--acc)}
.denom{font-weight:600}
.denom .sub{font-weight:400;color:var(--mut);font-size:12px;font-family:ui-monospace,monospace}
.denom .sub.owner{font-family:inherit;color:#93c5fd}
.cls{display:inline-block;font-family:ui-monospace,monospace;font-size:11px;padding:1px 6px;border-radius:5px;margin:1px;border:1px solid var(--bd)}
.cls.match{background:rgba(16,185,129,.15);border-color:var(--acc);color:var(--acc)}
.cls.rel{background:rgba(245,158,11,.12);border-color:var(--amb);color:var(--amb)}
.cls.other{color:var(--mut)}
.cls.none{color:var(--mut)}
.meta .apo{color:#5eead4;font-weight:500}
.badge{display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px}
.badge.file_opposition{background:rgba(239,68,68,.15);color:#fca5a5}
.badge.monitor_closely{background:rgba(245,158,11,.15);color:#fcd34d}
.badge.no_action{background:var(--bd);color:var(--mut)}
.badge.own{background:rgba(59,130,246,.15);color:#93c5fd}
.badge.firm{background:rgba(139,92,246,.15);color:#c4b5fd}
.prob{font-size:11px;color:var(--mut);margin-top:3px}
.reason{max-width:360px;color:var(--tx)}
.reason details{margin-top:6px} .reason summary{cursor:pointer;color:var(--acc);font-size:12px}
.reason details p{color:var(--mut);font-size:12px;margin:6px 0 0}
.foot{color:var(--mut);font-size:11px;text-align:center;margin-top:24px}
@media print{
  body{background:#fff;color:#111}
  .controls{display:none}
  .kpi,.pub{border-color:#ccc;background:#fff;break-inside:avoid}
  .pub{box-shadow:none}
  .badge.file_opposition{color:#b91c1c}.badge.monitor_closely{color:#b45309}
  .reason details{display:none}
}
</style></head><body>
<div class="wrap">
  <div class="top">
    <div>
      <h1>Informe de confundibilidad — Gaceta ${esc(meta.country)} N.º ${esc(meta.number)}</h1>
      <div class="sub">Publicada ${esc(meta.datePublic)} · Oposición hasta ${esc(meta.dateDue)} · ${meta.count} publicaciones analizadas</div>
    </div>
    <div class="kpis">
      <div class="kpi opp"><b>${nOpp}</b><span>Oponerse</span></div>
      <div class="kpi mon"><b>${nMon}</b><span>Vigilar</span></div>
      <div class="kpi own"><b>${nOwn}</b><span>Aviso publicación</span></div>
      <div class="kpi"><b>${cands.length}</b><span>Coincidencias</span></div>
    </div>
  </div>

  <div class="controls">
    ${aiRan ? '<button data-filter="risk" class="active">En riesgo</button>' : ""}
    ${nOwn ? '<button data-filter="own">Aviso publicación</button>' : ""}
    <button data-filter="all"${aiRan ? "" : ' class="active"'}>Todas</button>
    <div class="spacer"></div>
    <button onclick="window.print()">Imprimir / PDF</button>
  </div>

  <div id="list">${groups.map(groupBlock).join("")}</div>

  <div class="foot">Generado por vsion · barrido fonético/textual${aiRan ? " + revisión IA" : " (barrido sin IA — sin veredicto)"}</div>
</div>
<script>
  const AI_RAN=${aiRan ? "true" : "false"};
  const btns=[...document.querySelectorAll('.controls button[data-filter]')];
  function rowVisible(kind,mode){
    if(mode==='all') return true;
    if(mode==='risk') return kind==='file_opposition'||kind==='monitor_closely';
    if(mode==='own')  return kind==='own';
    return true;
  }
  function apply(mode){
    document.querySelectorAll('tr.cand').forEach(r=>{
      r.style.display=rowVisible(r.dataset.rec,mode)?'':'none';
    });
    // ocultar publicaciones sin filas visibles
    document.querySelectorAll('.pub').forEach(p=>{
      const any=[...p.querySelectorAll('tr.cand')].some(r=>r.style.display!=='none');
      p.style.display=any?'':'none';
    });
    btns.forEach(b=>b.classList.toggle('active',b.dataset.filter===mode));
  }
  btns.forEach(b=>b.onclick=()=>apply(b.dataset.filter));
  apply(AI_RAN?'risk':'all');
</script>
</body></html>`;
}
