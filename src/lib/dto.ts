import type { Candidate, GazetteMeta } from "@/types";

// DTO plano y serializable (los Candidate llevan Set en keys, no cruzan
// el límite del server action → hay que aplanar).

export interface CandDTO {
  clientDenom: string;
  clientCode: string;
  clientHolder: string;
  clientAttorney: string;
  clientStatus: string;
  clientClasses: number[];
  score: number;
  matchingClasses: number[];
  relatedClasses: number[];
  sameOwner: boolean;
  sameAttorney: boolean;
}

export interface PubDTO {
  denom: string;
  applicationNumber: string;
  applicant: string;
  representant: string;
  markType: string;
  image: string;
  classes: number[];
  candidates: CandDTO[];
  hasConflict: boolean;   // tiene algún candidato que NO es aviso (posible oposición)
  topScore: number;
}

export interface ReportDTO {
  meta: GazetteMeta;
  stats: { clientCount: number; gazetteCount: number; skipped: number; candidates: number; own: number };
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
        representant: c.gazette.representant,
        markType: c.gazette.markType,
        image: c.gazette.image,
        classes: c.gazette.classes,
        candidates: [],
        hasConflict: false,
        topScore: 0,
      };
      map.set(key, g);
    }
    g.candidates.push({
      clientDenom: c.client.denom,
      clientCode: c.client.code,
      clientHolder: c.client.holder,
      clientAttorney: c.client.attorney,
      clientStatus: c.client.status,
      clientClasses: c.client.classes,
      score: c.score,
      matchingClasses: c.matchingClasses,
      relatedClasses: c.relatedClasses,
      sameOwner: c.sameOwner,
      sameAttorney: c.sameAttorney,
    });
    if (!c.sameOwner) g.hasConflict = true;
    if (c.score > g.topScore) g.topScore = c.score;
  }

  for (const g of map.values()) {
    g.candidates.sort((a, b) => Number(a.sameOwner) - Number(b.sameOwner) || b.score - a.score);
  }
  const groups = [...map.values()].sort(
    (a, b) => Number(b.hasConflict) - Number(a.hasConflict) || b.topScore - a.topScore
  );

  const own = candidates.filter((c) => c.sameOwner).length;
  return {
    meta,
    stats: { ...extra, candidates: candidates.length, own },
    groups,
  };
}
