// symbol of ordinal collection, same as on MagicEden!
export enum KnownSymbolName {
  'ordinal-cubes-by-haus-hoppe' = 'ordinal-cubes-by-haus-hoppe',
  'to-the-edge' = 'to-the-edge'
}

export const allKnownTokenSymbols = (Object.keys(KnownSymbolName) as Array<keyof typeof KnownSymbolName>);
