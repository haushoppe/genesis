
/*
  RESPONSE of GET https://ordinalsbot.com/api/fxrate?ids=bitcoin&vs_currencies=usd

  {
    "bitcoin": {
      "usd":30157
    },

    "litecoin": {
      "usd":87.04
    },

    "updatedAt":1687817466557}
*/

export interface OrdinalsbotFxrateResult {
  bitcoin: {
    usd: number
  }
}
