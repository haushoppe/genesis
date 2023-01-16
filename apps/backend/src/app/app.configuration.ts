import * as Joi from 'joi';

import { KnownTokenConfig } from "./model/known-token-config";
import { KnownTokenName } from './model/known-token-name';

const allTokens: KnownTokenConfig[] = [{
  name: KnownTokenName.genesis,
  maximumAllowedMintsPerAddress: 4,
  address: '0x728265b4DD95E502EC46CF18E06787c57b473482',
  network: 'goerli',
  firstBlockNumber: 8240212,
  implementsMosaics: true
},
{
  name: KnownTokenName.mosaic,
  maximumAllowedMintsPerAddress: 4,
  address: '0x9d0C0eC7f18A7D017f716a602E8991640412E07f',
  network: 'goerli',
  firstBlockNumber: 8240308,
  implementsMosaics: true
},
{
  name: KnownTokenName.sea,
  maximumAllowedMintsPerAddress: 4,
  address: '0x3E1a35F35fCBb302EEBAD8D8c59aB0369065696E',
  network: 'goerli',
  firstBlockNumber: 8240402
},
{
  name: KnownTokenName.art,
  maximumAllowedMintsPerAddress: 4,
  address: '0xBF79e5797dd766288F7831689EF943b286f92d86',
  network: 'goerli',
  firstBlockNumber: 8240950
},
{
  name: KnownTokenName.artist,
  maximumAllowedMintsPerAddress: 4,
  address: '0x7dD31A2F91860E6cD82ba29D5C6c2497ea427ba6',
  network: 'goerli',
  firstBlockNumber: 8239512
},
{
  name: KnownTokenName.cube,
  maximumAllowedMintsPerAddress: 4,
  address: '0xB50f1A5149a68C1f27b4de2FC3aDC05A8410dA5D',
  network: 'goerli',
  firstBlockNumber: 8239852
},
{
  name: KnownTokenName.genesis,
  maximumAllowedMintsPerAddress: 4,
  address: '0xBF79e5797dd766288F7831689EF943b286f92d86',
  network: 'mainnet',
  firstBlockNumber: 16314164,
  implementsMosaics: true
},
{
  name: KnownTokenName.mosaic,
  maximumAllowedMintsPerAddress: 4,
  address: '0xa8af731F0513DA720691d423d0a6C839Ab5d4a22',
  network: 'mainnet',
  firstBlockNumber: 16314313,
  implementsMosaics: true
},
{
  name: KnownTokenName.sea,
  maximumAllowedMintsPerAddress: 4,
  address: '0xf05A5D8d9DCf1BB1D33B09322Cc52df320A04fC5',
  network: 'mainnet',
  firstBlockNumber: 16314834
},
{
  name: KnownTokenName.art,
  maximumAllowedMintsPerAddress: 4,
  address: '0xb40889c9fac33cd7684D3C9B14490EeE29a84761',
  network: 'mainnet',
  firstBlockNumber: 16315111
},
{
  name: KnownTokenName.artist,
  maximumAllowedMintsPerAddress: 4,
  address: '0x034F95d5EF960567e02af0Ac8C648288ad0b6691',
  network: 'mainnet',
  firstBlockNumber: 16313333
},
{
  name: KnownTokenName.cube,
  maximumAllowedMintsPerAddress: 4,
  address: '0x3E1a35F35fCBb302EEBAD8D8c59aB0369065696E',
  network: 'mainnet',
  firstBlockNumber: 16313800
}];

export const configuration = () => {

  const network = process.env.NETWORK;

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
    network,
    knownTokens: allTokens.filter(x => x.network === network),
    alchemyKey_goerli: process.env.ALCHEMY_KEY_MAINNET,
    alchemyKey_mainnet: process.env.ALCHEMY_KEY_GOERLI,
  }
}

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production'),
  PORT: Joi.number(),
  MONGODB_URI: Joi.string().required(),
  NETWORK: Joi.string().valid('mainnet', 'goerli'),
  SIGNER_KEY_GENESIS: Joi.string().required(),
  SIGNER_KEY_MOSAIC: Joi.string().required(),
  SIGNER_KEY_SEA: Joi.string().required(),
  SIGNER_KEY_ART: Joi.string().required(),
  SIGNER_KEY_ARTIST: Joi.string().required(),
  SIGNER_KEY_CUBE: Joi.string().required(),
  ALCHEMY_KEY_MAINNET: Joi.string().required(),
  ALCHEMY_KEY_GOERLI: Joi.string().required(),
})
