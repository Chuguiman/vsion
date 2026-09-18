import type { PhoneticKeys } from "./phonetics.js";

/** Marca del cliente (casos.json) — el derecho que se defiende */
export interface ClientMark {
  id: string;
  code: string;           // numero_de_caso_codigo
  denom: string;          // caso_titulo
  classes: number[];      // clases Niza
  pys: string;            // productos y servicios (texto)
  holder: string;         // titular
  status: string;         // estado_del_caso
  keys: PhoneticKeys;
}

/** Publicación de la gaceta (CO####.json) — la solicitud nueva a vigilar */
export interface GazetteEntry {
  denom: string;          // word
  classes: number[];      // clases
  pys: string;            // pys concatenado
  applicant: string;
  applicationNumber: string;
  markType: string;
  status: string;
  keys: PhoneticKeys;
}

export interface GazetteMeta {
  country: string;
  number: string;
  datePublic: string;
  dateDue: string;
  language: string;
  count: number;
}

/** Un par candidato tras el barrido */
export interface Candidate {
  gazette: GazetteEntry;
  client: ClientMark;
  score: number;               // 0..100
  breakdown: Record<string, number>;
  matchingClasses: number[];
  relatedClasses: number[];
  // Rellenado por la etapa IA:
  ai?: {
    recommendation: "file_opposition" | "monitor_closely" | "no_action";
    success_probability: number;
    summary: string;
    reasoning: string;
    model: string;
  };
}
