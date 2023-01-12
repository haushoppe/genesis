import * as Joi from 'joi';

export const configuration = () => {
  return {
    environment: process.env.NODE_ENV,
    port: process.env.PORT,
    mongodbUri: process.env.MONGODB_URI,
    signerKey_genesis: process.env.SIGNER_KEY_GENESIS,
    signerKey_mosaic: process.env.SIGNER_KEY_MOSAIC,
    signerKey_sea: process.env.SIGNER_KEY_SEA,
    signerKey_art: process.env.SIGNER_KEY_ART,
    signerKey_artist: process.env.SIGNER_KEY_ARTIST,
    signerKey_cube: process.env.SIGNER_KEY_CUBE,
  }
}

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production'),
  PORT: Joi.number(),
  MONGODB_URI: Joi.string().required(),
  SIGNER_KEY_GENESIS: Joi.string().required(),
  SIGNER_KEY_MOSAIC: Joi.string().required(),
  SIGNER_KEY_SEA: Joi.string().required(),
  SIGNER_KEY_ART: Joi.string().required(),
  SIGNER_KEY_ARTIST: Joi.string().required(),
  SIGNER_KEY_CUBE: Joi.string().required(),
})
