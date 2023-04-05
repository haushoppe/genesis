import { PseudoRandom } from "./pseudo-random";
import { Metadata } from "../types/metadata";
import { MintInfo } from "../types/mint-info";

const genericDescription = 'For this masterpiece artist Olaf Hoppe carved __AMOUNT__ different woodblocks and printed them on top of each other with absolute precision.'

const externalUrlLive = 'https://genesis.haushoppe.art/nft/';
const externalUrlLocalhost = 'http://localhost:4201/nft/';

const assetsBaseUrlLive = 'https://assets.haushoppe.art/genesis/';
const assetsBaseUrlLocalhost = 'http://localhost:8080/genesis/';

const mosaicBaseUrlLive = 'https://backend.haushoppe.art/api/tokenPreview/genesis/';
const mosaicBaseUrlLocalhost = 'http://localhost:3333/api/tokenPreview/genesis/';

const animationBaseUrlLive = 'https://backend.haushoppe.art/api/tokenAnimation/genesis/';
const animationBaseUrlLocalhost = 'http://localhost:3333/api/tokenAnimation/genesis/';

const animationMosaicBaseUrlLive = 'https://backend.haushoppe.art/api/tokenAnimation/genesis/';
const animationMosaicBaseUrlLocalhost = 'http://localhost:3333/api/tokenAnimation/genesis/';

const fallbackImage = "https://genesis.haushoppe.art/assets/question-mark.svg";


export interface WoodcutDetails {
  name: string;
  path: string;
  year: string; // as a number it would be shown as `2,001 of 2,001` on OS
  amountOfColors: number;
  mainColor: string;
  batch: number;
}

export const genesisRawArtworks: WoodcutDetails[] = [
  {
    name: 'Genesis I (Red Rose)',
    path: 'genesis1',
    year: '2001',
    amountOfColors: 7,
    mainColor: 'Red',
    batch: 0
  },
  {
    name: 'Genesis II (Blue Sunflower)',
    path: 'genesis2',
    year: '2001',
    amountOfColors: 5,
    mainColor: 'Blue',
    batch: 0
  },
  {
    name: 'Genesis III (Gray Seashell)',
    path: 'genesis3',
    year: '2001',
    amountOfColors: 6,
    mainColor: 'Gray',
    batch: 0
  },
  {
    name: 'Genesis IV (Yellow Dandelion)',
    path: 'genesis4',
    year: '2001',
    amountOfColors: 5,
    mainColor: 'Yellow',
    batch: 0
  }
  // ,{
  //   name: 'The Closed Door',
  //   path: 'closed-door',
  //   year: 2015,
  //   amountOfColors: 9,
  //   mainColor: 'Orange',
  //   batch: 1
  // }
];

export function createGenesisMetadata(tokenId: number, mint: MintInfo, availableMetadata: Metadata[]) {
  const r = new PseudoRandom(mint.transactionHash);
  const randomIndex = r.randomInt(0, availableMetadata.length - 1);
  const metadata = {
    ...getAndRemoveItem(availableMetadata, randomIndex),
    tokenId
  };
  metadata.external_url = metadata.external_url + tokenId;
  metadata.animation_url = metadata.animation_url + tokenId;
  return metadata;
}

export function createGenesisMosaicMetadata(
  tokenId: number,
  mosaicCounter: number,
  tokenTile1: Metadata,
  tokenTile2: Metadata,
  tokenTile3: Metadata,
  tokenTile4: Metadata,
  environment: string): Metadata {

  const externalUrl = environment === 'development' ? externalUrlLocalhost : externalUrlLive;
  const mosaicBaseUrl = environment === 'development' ? mosaicBaseUrlLocalhost : mosaicBaseUrlLive;
  const animationMosaicBaseUrl = environment === 'development' ? animationMosaicBaseUrlLocalhost : animationMosaicBaseUrlLive;

  const metadata: Metadata = {
    name: 'Mosaic #' + mosaicCounter,
    description:
      `A mosaic of four tiles:  \n`  // Markdown style linebreaks
    + `[${ tokenTile1.name } (Token #${ tokenTile1.tokenId })](${ tokenTile1.external_url })  \n`
    + `[${ tokenTile2.name } (Token #${ tokenTile2.tokenId })](${ tokenTile2.external_url })  \n`
    + `[${ tokenTile3.name } (Token #${ tokenTile3.tokenId })](${ tokenTile3.external_url })  \n`
    + `[${ tokenTile4.name } (Token #${ tokenTile4.tokenId })](${ tokenTile4.external_url })`,
    external_url: externalUrl + tokenId,
    animation_url: `${ animationMosaicBaseUrl}${ tokenId }/${ tokenTile1.tokenId }/${ tokenTile2.tokenId }/${ tokenTile3.tokenId }/${ tokenTile4.tokenId }`,
    image: mosaicBaseUrl + tokenId,

    tile1TokenId: tokenTile1.tokenId,
    tile2TokenId: tokenTile2.tokenId,
    tile3TokenId: tokenTile3.tokenId,
    tile4TokenId: tokenTile4.tokenId,

    tile1Image: tokenTile1.image,
    tile2Image: tokenTile2.image,
    tile3Image: tokenTile3.image,
    tile4Image: tokenTile4.image,
    attributes: [
      {
        trait_type: 'Special trait',
        value: 'Mosaic',
      }
    ],
    tokenId,
    isMosaic: true
  }

  return metadata
}

export function createFallbackImage(tokenId: number) {
  const metadata: Metadata = {
    name: 'Unrevealed #' + tokenId,
    description: 'Please stay tuned!',
    image: fallbackImage,
    attributes: [],
    tokenId
  }

  return metadata;
}

// only tokenId is missing, these entries are "unassigned"
export function createRawGenesisMetadata(artworks: WoodcutDetails[], environment: string) {

  const externalUrl = environment === 'development' ? externalUrlLocalhost : externalUrlLive;
  const animationBaseUrl = environment === 'development' ? animationBaseUrlLocalhost : animationBaseUrlLive;
  const assetsBaseUrl = environment === 'development' ? assetsBaseUrlLocalhost : assetsBaseUrlLive;

  const results: Metadata[] = [];

  artworks.forEach((artwork) => {

    const template: Metadata = {
      name: '?',
      description: genericDescription.replace('__AMOUNT__', artwork.amountOfColors + ''),
      external_url: externalUrl,
      animation_url: animationBaseUrl,
      image: '?',
      attributes: [
        {
          trait_type: 'Year',
          value: artwork.year
        },
        {
          trait_type: 'Amount of colors',
          value: artwork.amountOfColors,
          display_type: 'number'
        },
        {
          trait_type: 'Main color',
          value: artwork.mainColor
        }
      ]
    }

    // woodcuts!
    for (let i = 1; i <= artwork.amountOfColors; i++) {

      const metadata: Metadata = {
        ...template,
        name: artwork.name + ` – Woodcut ${i}`,
        description: template.description + ' Here you can see one of the individual color layers that will later be printed on top of each other.',
        attributes: [
          ...template.attributes,
          {
            trait_type: 'Colors',
            value: 1,
            display_type: 'number'
          },
          {
            trait_type: 'Type',
            value: 'Single print',
          }],
        image: assetsBaseUrl + artwork.path + `/woodcut${i}.jpg`
      };

      results.push(metadata);
    }

    // colors!
    for (let i = 2; i <= artwork.amountOfColors; i++) {

      const finalPiece = i === artwork.amountOfColors;
      const metatdata: Metadata = {
        ...template,
        name: artwork.name + ` – ${i} Colors` + (finalPiece ? ' (Final piece)' : ''),
        description: template.description + (finalPiece ? ' Here you can see the final artwork, with all the wooden blocks printed on top of each other.' : ' Here you can see a multi-layer color print where the different wood blocks are printed on top of each other.'),
        attributes: [
          ...template.attributes,
          {
            trait_type: 'Colors',
            value: i,
            display_type: 'number'
          },
          {
            trait_type: 'Type',
            value: 'Multilayer print',
          }],
        image: assetsBaseUrl + artwork.path + `/${i}colors.jpg`
      }

      if (finalPiece) {
        metatdata.attributes.push({
          trait_type: 'Special trait',
          value: 'Final piece',
        })
      }

      results.push(metatdata);
    }

  });

  return results;

}



/**
 * Changes the content of an array by removing the existing elements at the index
 * @param index to remove
 * @returns removed item
 */
function getAndRemoveItem<T>(arr: Array<T>, index: number): T {
  const el = arr[index];
  arr.splice(index, 1);
  return el;
}
