import { getDb } from "./db";
import type { CandDTO, PubDTO, ReportDTO } from "./dto";

// El payload de una corrida es una foto del momento del barrido: si entonces
// faltaba un dato (titular, clases…) o se recortó (productos/servicios), la
// vista y los exports lo arrastran para siempre. Aquí se completa con los datos
// vigentes de `publications` (gaceta) y `client_marks` (cartera de la org).
// Solo datos descriptivos: el resultado de la comparación (score, clases en
// común, relación, IA) se deja tal como se guardó.

const pick = (fresh: string | null | undefined, old: string | undefined) => {
  const f = (fresh ?? "").trim();
  return f || old || "";
};
const pickArr = (fresh: number[] | null | undefined, old: number[] | undefined) =>
  fresh && fresh.length ? fresh : old ?? [];

type PubRow = {
  denom: string; application_number: string | null; applicant: string | null; applicant_country: string | null;
  representant: string | null; application_date: string | null; mark_type: string | null; mark_category: string | null;
  status: string | null; classes: number[] | null; pys: string | null;
};
type MarkRow = {
  code: string | null; denom: string; holder: string | null; attorney: string | null; status: string | null;
  classes: number[] | null; pys: string | null; country: string | null; filed_date: string | null;
  valid_until: string | null; register_date: string | null; mark_type: string | null; category: string | null;
  cert_number: string | null; filing_country: string | null;
};

export async function hydrateReport(
  dto: ReportDTO, gazetteId: number | null, orgId: number | null
): Promise<ReportDTO> {
  const db = getDb();
  if (!db || !dto?.groups?.length) return dto;

  const appNums = [...new Set(dto.groups.map((g) => g.applicationNumber).filter(Boolean))];
  const codes = [...new Set(dto.groups.flatMap((g) => g.candidates.map((c) => c.clientCode)).filter(Boolean))];
  const denoms = [...new Set(dto.groups.flatMap((g) => g.candidates.map((c) => c.clientDenom)).filter(Boolean))];

  const [pubs, marks] = await Promise.all([
    gazetteId == null ? Promise.resolve([] as PubRow[]) : db<PubRow[]>`
      SELECT denom, application_number, applicant, applicant_country, representant, application_date,
             mark_type, mark_category, status, classes, pys
      FROM publications
      WHERE gazette_id = ${gazetteId}
        AND (application_number = ANY(${appNums}) OR denom = ANY(${dto.groups.map((g) => g.denom)}))`,
    orgId == null ? Promise.resolve([] as MarkRow[]) : db<MarkRow[]>`
      SELECT code, denom, holder, attorney, status, classes, pys, country, filed_date, valid_until,
             register_date, mark_type, category, cert_number, filing_country
      FROM client_marks
      WHERE organization_id = ${orgId} AND (code = ANY(${codes}) OR denom = ANY(${denoms}))`,
  ]);

  const pubByApp = new Map<string, PubRow>();
  const pubByDenom = new Map<string, PubRow>();
  for (const p of pubs) {
    if (p.application_number) pubByApp.set(p.application_number, p);
    if (!pubByDenom.has(p.denom)) pubByDenom.set(p.denom, p);
  }
  const markByCode = new Map<string, MarkRow>();
  const markByDenom = new Map<string, MarkRow | null>(); // null = denominación ambigua
  for (const m of marks) {
    if (m.code) markByCode.set(m.code, m);
    markByDenom.set(m.denom, markByDenom.has(m.denom) ? null : m);
  }

  const groups: PubDTO[] = dto.groups.map((g) => {
    const p = (g.applicationNumber && pubByApp.get(g.applicationNumber)) || (!g.applicationNumber ? pubByDenom.get(g.denom) : undefined);
    const pub: PubDTO = p ? {
      ...g,
      applicant: pick(p.applicant, g.applicant),
      applicantCountry: pick(p.applicant_country, g.applicantCountry),
      representant: pick(p.representant, g.representant),
      applicationDate: pick(p.application_date, g.applicationDate),
      markType: pick(p.mark_type, g.markType),
      markCategory: pick(p.mark_category, g.markCategory),
      status: pick(p.status, g.status),
      classes: pickArr(p.classes, g.classes),
      pys: pick(p.pys, g.pys),
    } : { ...g };

    const candidates: CandDTO[] = g.candidates.map((c) => {
      const m = (c.clientCode && markByCode.get(c.clientCode)) || markByDenom.get(c.clientDenom) || null;
      const cand: CandDTO = m ? {
        ...c,
        clientHolder: pick(m.holder, c.clientHolder),
        clientAttorney: pick(m.attorney, c.clientAttorney),
        clientStatus: pick(m.status, c.clientStatus),
        clientClasses: pickArr(m.classes, c.clientClasses),
        clientPys: pick(m.pys, c.clientPys),
        clientCountry: pick(m.country, c.clientCountry),
        clientFiled: pick(m.filed_date, c.clientFiled),
        clientValid: pick(m.valid_until, c.clientValid),
        clientRegister: pick(m.register_date, c.clientRegister),
        clientMarkType: pick(m.mark_type, c.clientMarkType),
        clientCategory: pick(m.category, c.clientCategory),
        clientCert: pick(m.cert_number, c.clientCert),
        clientFilingCountry: pick(m.filing_country, c.clientFilingCountry),
      } : { ...c };
      return cand;
    });
    return { ...pub, candidates };
  });

  return { ...dto, groups };
}
