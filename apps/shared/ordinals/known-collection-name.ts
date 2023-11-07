// our ordinal collectioss
export enum KnownCollectionName {
  cubes = 'cubes',
  edge = 'edge'
}

export const allKnownCollectionNames = (Object.keys(KnownCollectionName) as Array<keyof typeof KnownCollectionName>);
