import type { Candidate, GazetteMeta } from "@/types";

// DTO plano y serializable (los Candidate llevan Set en keys, no cruzan
// el límite del server action → hay que aplanar).

export type Relation = "own" | "firm" | "conflict";

export type AiVerdict = "file_opposition" | "monitor_closely" | "no_action";
export interface AiResult {
  recommendation: AiVerdict;
  prob: number;
  summary: string;
  reasoning: string;
}

export interface CandDTO {
  clientDenom: string;
  clientCode: string;
  clientHolder: string;
  clientAttorney: string;
  clientStatus: string;
  clientClasses: number[];
  clientPys: string;
  clientCountry: string;
  clientFiled: string;
  clientValid: string;
  clientRegister: string;
  score: number;
  matchingClasses: number[];
  relatedClasses: number[];
  relation: Relation;   // own = tu marca | firm = tu firma la presentó | conflict = tercero
  ai?: AiResult;        // veredicto IA (solo conflictos, tras Fase 2)
}

/** own = mismo titular; firm = tu firma es el apoderado de la solicitud; conflict = tercero */
function relationOf(c: Candidate): Relation {
  if (c.sameOwner) return "own";
  if (c.sameAttorney) return "firm";
  return "conflict";
}

export interface PubDTO {
  denom: string;
  applicationNumber: string;
  applicant: string;
  applicantCountry: string;
  representant: string;
  applicationDate: string;
  priority: string;
  markType: string;
  image: string;
  classes: number[];
  pys: string;
  candidates: CandDTO[];
  hasConflict: boolean;   // tiene algún candidato que NO es aviso (posible oposición)
  topScore: number;
}

export interface ReportDTO {
  meta: GazetteMeta;
  stats: { clientCount: number; gazetteCount: number; skipped: number; candidates: number; own: number; firm: number; conflict: number };
  groups: PubDTO[];
}

export function toReportDTO(
  candidates: Candidate[],
  meta: GazetteMeta,
  extra: { clientCount: number; gazetteCount: number; skipped: number }
): ReportDTO {
  const map = new Map<string, PubDTO>();
  for (const c of candidates) {
    const key = c.gazette.applicationNumber || c.gazette.denom;
    let g = map.get(key);
    if (!g) {
      g = {
        denom: c.gazette.denom,
        applicationNumber: c.gazette.applicationNumber,
        applicant: c.gazette.applicant,
        applicantCountry: c.gazette.applicantCountry,
        representant: c.gazette.representant,
        applicationDate: c.gazette.applicationDate,
        priority: c.gazette.priority,
        markType: c.gazette.markType,
        image: c.gazette.image,
        classes: c.gazette.classes,
        pys: c.gazette.pys.slice(0, 500),
        candidates: [],
        hasConflict: false,
        topScore: 0,
      };
      map.set(key, g);
    }
    const relation = relationOf(c);
    g.candidates.push({
      clientDenom: c.client.denom,
      clientCode: c.client.code,
      clientHolder: c.client.holder,
      clientAttorney: c.client.attorney,
      clientStatus: c.client.status,
      clientClasses: c.client.classes,
      clientPys: c.client.pys.slice(0, 400),
      clientCountry: c.client.country,
      clientFiled: c.client.filedDate,
      clientValid: c.client.validUntil,
      clientRegister: c.client.registerDate,
      score: c.score,
      matchingClasses: c.matchingClasses,
      relatedClasses: c.relatedClasses,
      relation,
    });
    if (relation === "conflict") g.hasConflict = true;
    if (c.score > g.topScore) g.topScore = c.score;
  }

  const rank: Record<Relation, number> = { conflict: 0, firm: 1, own: 2 };
  for (const g of map.values()) {
    g.candidates.sort((a, b) => rank[a.relation] - rank[b.relation] || b.score - a.score);
  }
  const groups = [...map.values()].sort(
    (a, b) => Number(b.hasConflict) - Number(a.hasConflict) || b.topScore - a.topScore
  );

  const own = candidates.filter((c) => relationOf(c) === "own").length;
  const firm = candidates.filter((c) => relationOf(c) === "firm").length;
  const conflict = candidates.filter((c) => relationOf(c) === "conflict").length;
  return {
    meta,
    stats: { ...extra, candidates: candidates.length, own, firm, conflict },
    groups,
  };
}
