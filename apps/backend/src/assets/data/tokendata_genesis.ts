import { Metadata } from "../../app/types/metadata";

const genericDescription = 'For this masterpiece artist Olaf Hoppe carved __AMOUNT__ different woodblocks and printed them on top of each other with absolute precision.'
const externalUrl = 'https://genesis.haushoppe.art/';
const assetsBaseUrlLive = 'https://assets.haushoppe.art/genesis/';
const assetsBaseUrlLocalhost = 'http://localhost:8080/genesis/';
const mosaicBaseUrlLive = 'https://backend.haushoppe.art/api/mosaicPreview/genesis/';
const mosaicBaseUrlLocalhost = 'http://localhost:3333/api/mosaicPreview/genesis/';
const fallbackImage = "https://genesis.haushoppe.art/assets/question-mark.svg";


export interface WoodcutDetails {
  name: string;
  path: string;
  year: number;
  amountOfColors: number;
  mainColor: string;
  batch: number;
}

export const genesisRawArtworks: WoodcutDetails[] = [
  {
    name: 'Genesis I (Red Rose)',
    path: 'genesis1',
    year: 2001,
    amountOfColors: 7,
    mainColor: 'Red',
    batch: 0
  },
  {
    name: 'Genesis II (Blue Sunflower)',
    path: 'genesis2',
    year: 2001,
    amountOfColors: 5,
    mainColor: 'Blue',
    batch: 0
  },
  {
    name: 'Genesis III (Gray Seashell)',
    path: 'genesis3',
    year: 2001,
    amountOfColors: 6,
    mainColor: 'Gray',
    batch: 0
  },
  {
    name: 'Genesis IV (Yellow Dandelion)',
    path: 'genesis4',
    year: 2001,
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

export function createGenesisMosaicMetadata(
  tokenId: number,
  mosaicCounter: number,
  tokenTile1: Metadata,
  tokenTile2: Metadata,
  tokenTile3: Metadata,
  tokenTile4: Metadata,
  environment: string): Metadata {

  const mosaicBaseUrl = environment === 'development' ? mosaicBaseUrlLocalhost : mosaicBaseUrlLive;

  const metadata: Metadata = {
    name: 'Mosaic #' + mosaicCounter,
    description:
`A mosaic of four tiles:
${tokenTile1.name} (${tokenTile1.tokenId})
${tokenTile2.name} (${tokenTile2.tokenId})
${tokenTile3.name} (${tokenTile3.tokenId})
${tokenTile4.name} (${tokenTile4.tokenId})`,
    external_url: externalUrl,
    image: mosaicBaseUrl + tokenId,
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
    tokenId
  }

  return metadata
}

export function createFallbackImage(tokenId: number) {
  const metadata: Metadata = {
    name: 'Unrevealed #' + tokenId,
    description: 'Please stay tuned!',
    external_url: externalUrl,
    image: fallbackImage,
    attributes: [],
    tokenId
  }

  return metadata;
}

// only tokenId is missing, these entries are "unassigned"
export function createRawGenesisMetadata(artworks: WoodcutDetails[], environment: string) {

  const assetsBaseUrl = environment === 'development' ? assetsBaseUrlLocalhost : assetsBaseUrlLive;
  const results: Metadata[] = [];

  artworks.forEach((artwork) => {

    const template: Metadata = {
      name: '?',
      description: genericDescription.replace('__AMOUNT__', artwork.amountOfColors + ''),
      external_url: externalUrl,
      image: '?',
      attributes: [
        {
          trait_type: 'Year',
          value: artwork.year,
          display_type: 'number'
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

