export interface RawScale {
  "_id": string,
  "name": string,
  "image": string,
  "tokenId": number,
  "attributes": [
    {
      "trait_type": string,
      "value": string
    }
  ],
  "Parent Painting Row Amount": string,
  "Parent Painting Column Amount": string,
  "Row": string,
  "Column": string,
  "Artist Name": string,
  "Collection Name": string,
  "id": string,
  "painting": string,
  "owner": string,
  "owned_by_us": boolean,
  "last_updated": string,
  "last_updated_block": number,
  "last_updated_tx": string,
  "owner_username": string,
  "image_thumbnail_url": string
}

export interface Scale {
  _id: string,
  name: string,
  image: string,
  token_id: number,
  parent_painting: string
  parent_painting_row_amount: number,
  parent_painting_column_amount: number,
  row: number,
  column: number,
  id: string,
  painting: string,
  owner: string,
  owned_by_us: boolean,
  last_updated: string,
  last_updated_block: number,
  last_updated_tx: string,
  owner_username: string,
  image_thumbnail_url: string
}

export function mapScale(s: RawScale): Scale {
  return {
    _id: s._id,
    name: s.name,
    image: s.image,
    token_id: s.tokenId,
    parent_painting: s.attributes.find(x => x.trait_type === 'Parent Painting')?.value || 'unknown',
    parent_painting_row_amount: +s["Parent Painting Row Amount"],
    parent_painting_column_amount: +s["Parent Painting Column Amount"],
    row: +s.Row,
    column: +s.Column,
    id: s.id,
    painting: s.painting,
    owner: s.owner,
    owned_by_us: s.owned_by_us,
    last_updated: s.last_updated,
    last_updated_block: s.last_updated_block,
    last_updated_tx: s.last_updated_tx,
    owner_username: s.owner_username,
    image_thumbnail_url: s.image_thumbnail_url
  }
}

export function groupScalesByParentPainting(scales: Scale[]): { [key: string] : Scale[] } {
  return scales.reduce(
    (acc: { [key: string] : Scale[] }, item: Scale) => ({
      ...acc,
      [item.parent_painting]: [...(acc[item.parent_painting] ?? []), item],
    }),
    {},
  );
}

export function toArrayOfArray(groupedScales: { [key: string] : Scale[] }): Scale[][] {
  const result: Scale[][] = [];

  Object.keys(groupedScales).forEach((key) => {
    const group = groupedScales[key];
    result.push(group);
  });

  return result;
}

