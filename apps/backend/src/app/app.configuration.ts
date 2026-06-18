import * as Joi from 'joi';

import { knownTokens } from './config/known-tokens';
import { KnownNetworkName } from '../shared/known-network-name';


export const configuration = () => {

  const network = process.env.NETWORK;

  return {
    environment: process.env.NODE_ENV,
    port: process.env.PORT,
    // mongodbUri: process.env.MONGODB_URI,
    signerKey_genesis: process.env.SIGNER_KEY_GENESIS,
    signerKey_mosaic: process.env.SIGNER_KEY_MOSAIC,
    signerKey_sea: process.env.SIGNER_KEY_SEA,
    signerKey_art: process.env.SIGNER_KEY_ART,
    signerKey_artist: process.env.SIGNER_KEY_ARTIST,
    signerKey_cube: process.env.SIGNER_KEY_CUBE,
    network,
    knownTokens: knownTokens.filter(x => x.networkName === network),
    alchemyKey_goerli: process.env.ALCHEMY_KEY_MAINNET,
    alchemyKey_mainnet: process.env.ALCHEMY_KEY_GOERLI,
  }
}

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production'),
  PORT: Joi.number(),
  // MONGODB_URI: Joi.string().required(),
  NETWORK: Joi.string().valid(KnownNetworkName.hardhat, KnownNetworkName.goerli, KnownNetworkName.mainnet),
  SIGNER_KEY_GENESIS: Joi.string().required(),
  SIGNER_KEY_MOSAIC: Joi.string().required(),
  SIGNER_KEY_SEA: Joi.string().required(),
  SIGNER_KEY_ART: Joi.string().required(),
  SIGNER_KEY_ARTIST: Joi.string().required(),
  SIGNER_KEY_CUBE: Joi.string().required(),
  ALCHEMY_KEY_MAINNET: Joi.string().required(),
  ALCHEMY_KEY_GOERLI: Joi.string().required(),
})
