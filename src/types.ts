import type { PhoneticKeys } from "./phonetics";

/** Marca del cliente (casos.json) — el derecho que se defiende */
export interface ClientMark {
  id: string;
  code: string;           // numero_de_caso_codigo
  denom: string;          // caso_titulo (vacío = figurativa/3D/animada)
  markType: string;       // Mixta / Nominativa / Figurativa / Tridimensional / Animada…
  classes: number[];      // clases Niza
  pys: string;            // productos y servicios (texto)
  holder: string;         // titular (nombre)
  attorney: string;       // apoderado (nombre)
  status: string;         // estado_del_caso
  country: string;        // país del titular (última parte de titular)
  filedDate: string;      // fecha_de_radicacion
  validUntil: string;     // vigencia
  registerDate: string;   // fecha_de_registro
  keys: PhoneticKeys;
}

/** Publicación de la gaceta (CO####.json) — la solicitud nueva a vigilar */
export interface GazetteEntry {
  denom: string;          // word
  classes: number[];      // clases
  pys: string;            // pys concatenado
  applicant: string;      // solicitante
  applicantCountry: string; // país del solicitante
  representant: string;   // representante / apoderado
  applicationNumber: string;
  applicationDate: string; // fecha de solicitud
  priority: string;       // prioridad (si aplica)
  markType: string;
  status: string;
  image: string;          // id de imagen SIC (p.ej. "0900000282554b53")
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
  sameOwner: boolean;          // mismo titular → aviso de publicación, no oposición
  sameAttorney: boolean;       // mismo apoderado (corrobora)
  // Rellenado por la etapa IA:
  ai?: {
    recommendation: "file_opposition" | "monitor_closely" | "no_action";
    success_probability: number;
    summary: string;
    reasoning: string;
    model: string;
  };
}
