import { Injectable, Logger } from '@nestjs/common';

import { CubeSuggestion } from '../../types/ordinals/cube-suggestion';
import { CollectionDetails, CollectionStat } from '../../types/ordinals/types-magic-eden';
import { CubeService } from './cube.service';
import { MagicEdenService } from './magic-eden.service';
import { collectClaimedInscriptionIds } from './cube-helper';

@Injectable()
export class CubeSuggestionService {

  private readonly TOKEN_GOAL = 6;

  constructor(private magicEdenService: MagicEdenService,
    private cubeService: CubeService) {}

  async getCubeSuggestion(onlyCollectionSymbol: string | undefined): Promise<CubeSuggestion | undefined> {

    const unclaimedTokens = await this.findUnclaimedTokens(onlyCollectionSymbol);
    const { tokenIds, collectionName, collectionSymbol } = unclaimedTokens

    return {
      inscriptionId1: tokenIds[0],
      inscriptionId2: tokenIds[1],
      inscriptionId3: tokenIds[2],
      inscriptionId4: tokenIds[3],
      inscriptionId5: tokenIds[4],
      inscriptionId6: tokenIds[5],
      collectionName,
      collectionSymbol
    };
  }

  async findUnclaimedTokens(onlyCollectionSymbol: string | undefined): Promise<{ tokenIds: string[], collectionName: string, collectionSymbol: string  } | undefined> {

    const allCubes = await this.cubeService.getAllCubes();
    const claimedTokenIds = collectClaimedInscriptionIds(allCubes);

    let collections: CollectionStat[] | CollectionDetails[] = [];

    if (!onlyCollectionSymbol) {
      collections = await this.magicEdenService.fetchPopularCollections({
        window: '7d',
        limit: 120 // max possible number
      });
    } else {
      const singleCollection = await this.magicEdenService.fetchCollectionDetails(onlyCollectionSymbol);
      if (!singleCollection) {
        throw new Error('Unknown collection!');
      }
      collections = [singleCollection];
    }

    while (collections.length > 0) {

      // Choose a random collection
      const collectionIndex = Math.floor(Math.random() * collections.length);
      const currentCollection = collections[collectionIndex];
      const collectionSymbol = currentCollection.symbol;

      // Fetch the first page of tokens from the chosen collection
      let offset = 0;
      const tokenIdMatches: string[] = [];
      let collectionEndReached = false;

      while (!collectionEndReached && tokenIdMatches.length < this.TOKEN_GOAL) {
        const tokens = await this.magicEdenService.fetchTokens({
          limit: 40,
          offset,
          sortBy: 'inscriptionNumberAsc',
          collectionSymbol
        });

        if (!tokens.tokens[0]) {
          break; // for the unrealistic case that a collection is empty
        }

        this.shuffleArray(tokens.tokens);

        // Check if the contentType of the first token is an image
        if (!this.isImageContentType(tokens.tokens[0].contentType)) {
          // console.log(currentCollection.name + '/' + tokens.tokens[0].id + ' has contentType ' + tokens.tokens[0]?.contentType + '! Skipping...')
          collections.splice(collectionIndex, 1);  // remove collection from the list
          break;  // break out of the inner loop to choose a new collection
        }

        for (const token of tokens.tokens) {
          if (!claimedTokenIds.includes(token.id)) {
            tokenIdMatches.push(token.id);
            // console.log('Adding ContentType', token.contentType);
            // Logger.verbose('Added: Inscription ' + token.id)

          } else {
            // Logger.verbose('Inscription is already claimed. Skipping: ' + token.id)
          }
          if (tokenIdMatches.length === this.TOKEN_GOAL) {
            break;  // break out of the loop if we have found enough tokens
          }
        }

        if (tokens.tokens.length < 20) {
          collectionEndReached = true;  // this was the last page of the collection
        } else {
          offset += 40;  // go to the next page
        }
      }

      // If we found enough tokens, return them
      if (tokenIdMatches.length === this.TOKEN_GOAL) {
        const collectionName =  currentCollection.name;
        const collectionSymbol =  currentCollection.symbol;

        // console.log('New suggestion', collectionName, collectionSymbol);

        return {
          tokenIds: tokenIdMatches,
          collectionName,
          collectionSymbol
        };
      }

      // Otherwise, remove the collection from the list and try a new one in the next iteration
      collections.splice(collectionIndex, 1);
    }

    throw new Error('Could not find enough unclaimed tokens!');
  }

  // check all possible content types here:
  // see: https://github.com/ordinals/ord/blob/05c10a73f2d29838b894e3c56849762dbe6dc51c/src/media.rs#L20
  isImageContentType(contentType: string): boolean {
    const supportedTypes = [
      'image/jpeg',
      'image/png',
      'image/bmp',
      'image/gif',
      'image/webp'
    ];
    return supportedTypes.includes(contentType);
  }

  /**
   * Randomize array in-place using Durstenfeld shuffle algorithm
   * https://stackoverflow.com/a/12646864
   */
  shuffleArray<T>(array: T[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
