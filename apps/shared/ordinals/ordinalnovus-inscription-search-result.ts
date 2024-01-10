
// shortest version, more possible params that can be requested:
export interface OrdinalnovusInscription {
  _id: string, // looks like a MongoDB ObjectId
  inscription_id: string,
  inscription_number: number,
  content: string,
  block: number
}

export interface OrdinalnovusInscriptionSearchResult {
  inscriptions: OrdinalnovusInscription[],
  pagination: {
    page: number,
    limit: number,
    total: number
  }
}

export interface LooksLikeOrdinalsbotInscription {
  inscriptionid: string,
  inscriptionnumber: number,
  contentstr: string,
  blockheight: number
};
