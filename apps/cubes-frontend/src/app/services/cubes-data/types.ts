// Local frontend types — identical shape to what the old auto-generated
// OpenAPI client exposed, so components don't need to change.

export interface Attribute {
  trait_type: string;
  value: string;
}

export interface Meta {
  name: string;
  attributes: Attribute[];
}

export interface InscriptionExtended {
  inscriptionId: string;
  inscriptionNumber: number;
  blockHeight: number;
  meta: Meta;
}

export interface InscriptionExtendedPaginatedResult {
  inscriptions: InscriptionExtended[];
  totalInscriptions: number;
  itemsPerPage: number;
  currentPage: number;
}

export interface InscriptionExtendedSingleResult {
  inscription: InscriptionExtended;
  previousInscriptionId: string | null;
  nextInscriptionId: string | null;
}

export interface CubeSuggestion {
  inscriptionId1: string;
  inscriptionId2: string;
  inscriptionId3: string;
  inscriptionId4: string;
  inscriptionId5: string;
  inscriptionId6: string;
  collectionName: string;
  collectionSymbol: string;
}
