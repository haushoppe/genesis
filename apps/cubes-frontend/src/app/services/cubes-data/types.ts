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
  /** The rarity rows of the listed cubes, present when the list is sorted by rarity. */
  rarity?: Map<string, CubeRarity>;
  /**
   * Whether the rarity index could be fetched at all.
   *
   * Distinct from `rarity` being absent, which is also the normal case for a
   * newest-first list. When the index is down, a rarity-sorted list falls back
   * to newest-first, and the sort control cannot tell: its pressed state comes
   * from the URL. Without this the reader sees "Rarity" marked as the applied
   * order over cubes in a different order, with no badges and no explanation,
   * and toggling the control changes nothing.
   */
  rarityAvailable?: boolean;
}

export interface InscriptionExtendedSingleResult {
  inscription: InscriptionExtended;
  previousInscriptionId: string | null;
  nextInscriptionId: string | null;
}

export type CubeRarityStatus = 'scored' | 'cursed' | 'after-close';
export type CubeCurse = 'duplicate-side' | 'black-side' | 'reused-inscription';

/** One row of `rarity.json` (see the cubes-index README, "Rarity"). */
export interface CubeRarity {
  inscriptionId: string;
  position: number;
  status: CubeRarityStatus;
  cursed: CubeCurse[];
  /** 1-based faces that do not render as an image. */
  blackSides: number[];
  /** 1-based faces whose inscription an earlier cube claimed first. */
  reusedSides: number[];
  /**
   * 1-based faces whose side the browser refuses as a WebGL texture source.
   * They rendered when the cube was minted and go black in a viewer that hands
   * them to WebGL unchanged; this one rasterises them back into view.
   * Optional: older index payloads pre-date the fact.
   */
  chromeSides?: number[];
  /** The one collection all six sides come from, else null. */
  collection: string | null;
  collections: string[];
  validOrdinal: number | null;
  tier: number | null;
  tierBonus: number | null;
  popularity: number | null;
  popularityPoints: number | null;
  score: number | null;
  rank: number | null;
}

export interface RarityIndex {
  totalCubes: number;
  scoredCubes: number;
  cursedCubes: number;
  afterCloseCubes: number;
  /** Cubes with at least one face the browser refuses as a texture. */
  chromeCubes?: number;
  collections: { symbol: string; cubes: number; points: number }[];
  cubes: CubeRarity[];
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
