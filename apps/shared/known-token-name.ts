export enum KnownTokenName {
  genesis = 'genesis',
  mosaic = 'mosaic',
  sea = 'sea',
  art = 'art',
  artist = 'artist',
  cube = 'cube'
}

export const allKnownTokenNames = (Object.keys(KnownTokenName) as Array<keyof typeof KnownTokenName>);
