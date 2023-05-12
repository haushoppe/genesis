import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Metadata } from '../types/metadata';
import { MintInfo } from '../types/mint-info';
import { PseudoRandom } from './pseudo-random';

const descriptionNormalToken = 'The Genesis collection is a series of woodcut artworks inspired by the spiritual '
  + 'and mystical elements of the biblical creation story. Crafted using traditional techniques, the final woodcuts '
  + 'and all stages in the printing process have been transformed into digital collectibles.  \n'
  + '  \n'
  + 'This is a unique digital representation of a physical original. For this masterpiece artist Olaf Hoppe carved **__AMOUNT__ different woodblocks** and printed them on top of each other with absolute precision.'

const descriptionMosaicToken = 'The Genesis collection is a series of woodcut artworks inspired by the spiritual '
  + 'and mystical elements of the biblical creation story. Crafted using traditional techniques, the final woodcuts '
  + 'and all stages in the printing process have been transformed into digital collectibles.  \n'
  + '  \n'
  + 'This is a mosaic that has been assembled from four other elements from the collection:  \n'

const externalUrlLive = 'https://genesis.haushoppe.art/nft/';
const externalUrlLocalhost = 'http://localhost:4201/nft/';

const assetsBaseUrlLive = 'https://assets.haushoppe.art/genesis/';
const assetsBaseUrlLocalhost = 'http://localhost:8080/genesis/';

const tokenPreviewBaseUrlLive = 'https://backend.haushoppe.art/api/tokenPreview/genesis/';
const tokenPreviewBaseUrlLocalhost = 'http://localhost:3333/api/tokenPreview/genesis/';

const animationBaseUrlLive = 'https://backend.haushoppe.art/api/tokenAnimation/genesis/';
const animationBaseUrlLocalhost = 'http://localhost:3333/api/tokenAnimation/genesis/';

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
  //   year: '2015',
  //   amountOfColors: 9,
  //   mainColor: 'Orange',
  //   batch: 1
  // }
];

@Injectable()
export class MetadataGenesisService {

  private environment = this.configService.get('environment');

  constructor(private configService: ConfigService) { }

  /**
   * This function generates the unassigned metatdata via the genesisRawArtworks array
   */
  generateRawGenesisMetadata() {

    const externalUrl = this.environment === 'development' ? externalUrlLocalhost : externalUrlLive;
    const animationBaseUrl = this.environment === 'development' ? animationBaseUrlLocalhost : animationBaseUrlLive;
    const tokenPreviewBaseUrl = this.environment === 'development' ? tokenPreviewBaseUrlLocalhost : tokenPreviewBaseUrlLive;
    const assetsBaseUrl = this.environment === 'development' ? assetsBaseUrlLocalhost : assetsBaseUrlLive;

    const results: Metadata[] = [];

    genesisRawArtworks.forEach((artwork) => {

      const template: Metadata = {
        name: '?',
        description: descriptionNormalToken.replace('__AMOUNT__', artwork.amountOfColors + ''),
        external_url: externalUrl,
        animation_url: animationBaseUrl,
        image: tokenPreviewBaseUrl,
        attributes: [
          {
            trait_type: 'Year',
            value: artwork.year
          },
          {
            trait_type: 'Artwork main color',
            value: artwork.mainColor
          },
          {
            trait_type: 'Final colors',
            value: artwork.amountOfColors,
            display_type: 'number'
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
          rawImage: assetsBaseUrl + artwork.path + `/woodcut${i}.jpg`
        };

        results.push(metadata);
      }

      // colors!
      for (let i = 2; i <= artwork.amountOfColors; i++) {

        const finalPiece = i === artwork.amountOfColors;
        const metatdata: Metadata = {
          ...template,
          name: artwork.name + ` – ${i} Colors` + (finalPiece ? ' (Final piece)' : ''),
          description: template.description + (finalPiece ? ' Here you can see the final artwork, with all the wooden blocks printed on top of each other.' : ' Here you can see the multi-layer color print where the different wood blocks are printed on top of each other.'),
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
          rawImage: assetsBaseUrl + artwork.path + `/${i}colors.jpg`
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

  public generateMetadata(allMints: MintInfo[]): Metadata[] {

    const rawMetadata = this.generateRawGenesisMetadata();
    const availableRawMetadata = [...rawMetadata];
    const result: Metadata[] = []; // array index == tokenId!!
    let mosaicCounter = 0;

    allMints.forEach(mint => {

      const tokenId = mint.tokenId;
      let metadata: Metadata;

      if (!mint.isMosaic) {

        if (availableRawMetadata.length) {
          // note: this alters the availableRawMetadata array until it is empty!
          metadata = this.createMetadataForNormalToken(tokenId, mint, availableRawMetadata);
        } else {
          // we have a problem: we sold too much! :-/
          metadata = this.createFallbackImage(tokenId);
        }

      } else {

        mosaicCounter++;
        const tokenTile1 = result[mint.mosaics[0]];
        const tokenTile2 = result[mint.mosaics[1]];
        const tokenTile3 = result[mint.mosaics[2]];
        const tokenTile4 = result[mint.mosaics[3]];
        metadata = this.createMetadataForMosaicToken(tokenId, mosaicCounter, tokenTile1, tokenTile2, tokenTile3, tokenTile4);
      }

      result.push(metadata);

    });

    return result;
  }

  createMetadataForNormalToken(tokenId: number, mint: MintInfo, availableMetadata: Metadata[]) {
    const r = new PseudoRandom(mint.transactionHash);
    const randomIndex = r.randomInt(0, availableMetadata.length - 1);
    const metadata = {
      ...getAndRemoveItemFromArray(availableMetadata, randomIndex),
      tokenId
    };
    metadata.external_url = metadata.external_url + tokenId;
    metadata.image = metadata.image + tokenId;
    metadata.animation_url = metadata.animation_url + tokenId;
    return metadata;
  }

  createMetadataForMosaicToken(
    tokenId: number,
    mosaicCounter: number,
    tokenTile1: Metadata,
    tokenTile2: Metadata,
    tokenTile3: Metadata,
    tokenTile4: Metadata): Metadata {

    const externalUrl = this.environment === 'development' ? externalUrlLocalhost : externalUrlLive;
    const tokenPreviewBaseUrl = this.environment === 'development' ? tokenPreviewBaseUrlLocalhost : tokenPreviewBaseUrlLive;
    const animationBaseUrl = this.environment === 'development' ? animationBaseUrlLocalhost : animationBaseUrlLive;

    const metadata: Metadata = {
      name: 'Genesis Mosaic #' + mosaicCounter,
      description: descriptionMosaicToken
        + `[${tokenTile1.name} (Token #${tokenTile1.tokenId})](${tokenTile1.external_url})  \n`
        + `[${tokenTile2.name} (Token #${tokenTile2.tokenId})](${tokenTile2.external_url})  \n`
        + `[${tokenTile3.name} (Token #${tokenTile3.tokenId})](${tokenTile3.external_url})  \n`
        + `[${tokenTile4.name} (Token #${tokenTile4.tokenId})](${tokenTile4.external_url})`,
      external_url: externalUrl + tokenId,
      animation_url: `${animationBaseUrl}${tokenId}/${tokenTile1.tokenId}/${tokenTile2.tokenId}/${tokenTile3.tokenId}/${tokenTile4.tokenId}`,
      image: tokenPreviewBaseUrl + tokenId,

      tile1TokenId: tokenTile1.tokenId,
      tile2TokenId: tokenTile2.tokenId,
      tile3TokenId: tokenTile3.tokenId,
      tile4TokenId: tokenTile4.tokenId,

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

  createFallbackImage(tokenId: number) {
    const metadata: Metadata = {
      name: 'Unrevealed #' + tokenId,
      description: 'Please stay tuned!',
      image: fallbackImage,
      attributes: [],
      tokenId
    }

    return metadata;
  }
}


/**
 * Changes the content of an array by removing the existing elements at the index
 * @param index to remove
 * @returns removed item
 */
function getAndRemoveItemFromArray<T>(arr: Array<T>, index: number): T {
  const el = arr[index];
  arr.splice(index, 1);
  return el;
}
