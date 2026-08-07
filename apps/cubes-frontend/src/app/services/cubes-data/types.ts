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
  /**
   * Unix seconds — the timestamp of the block that contains this
   * cube's reveal tx. Immutable on-chain fact, stored directly in
   * the static index so the UI never has to round-trip.
   */
  timestamp?: number;
  meta: Meta;
  /**
   * Lowercased ordinals address that received this cube's reveal-tx
   * vout[0]. Optional because early index payloads pre-date the
   * field; new grind runs always populate it.
   */
  firstOwner?: string | null;
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
