import { Injectable, Logger } from '@nestjs/common';

import { CubeSuggestion } from '../../types/ordinals/cube-suggestion';
import { CubeService } from './cube.service';
import { collectClaimedInscriptionIds } from './inscription-helper';
import { ArchiveCollection, OrdinalsArchiveService } from './ordinals-archive.service';

@Injectable()
export class CubeSuggestionService {

  private readonly TOKEN_GOAL = 6;
  private readonly TOP_COLLECTION_POOL = 250;

  constructor(
    private archiveService: OrdinalsArchiveService,
    private cubeService: CubeService,
  ) {}

  async getCubeSuggestion(onlyCollectionSymbol: string | undefined): Promise<CubeSuggestion | undefined> {
    const { tokenIds, collectionName, collectionSymbol } = await this.findUnclaimedTokens(onlyCollectionSymbol);
    return {
      inscriptionId1: tokenIds[0],
      inscriptionId2: tokenIds[1],
      inscriptionId3: tokenIds[2],
      inscriptionId4: tokenIds[3],
      inscriptionId5: tokenIds[4],
      inscriptionId6: tokenIds[5],
      collectionName,
      collectionSymbol,
    };
  }

  async findUnclaimedTokens(onlyCollectionSymbol: string | undefined): Promise<{
    tokenIds: string[];
    collectionName: string;
    collectionSymbol: string;
  }> {
    const allCubes = await this.cubeService.getAllCubes();
    const claimedTokenIds = new Set(collectClaimedInscriptionIds(allCubes));

    let candidates: ArchiveCollection[];
    if (!onlyCollectionSymbol) {
      candidates = await this.archiveService.getTopCollections(this.TOP_COLLECTION_POOL);
    } else {
      const single = await this.archiveService.getCollection(onlyCollectionSymbol);
      if (!single) {
        throw new Error('Unknown collection!');
      }
      candidates = [single];
    }

    // Mutable copy — we splice out exhausted collections as we go.
    const pool = [...candidates];

    while (pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      const current = pool[idx];

      let inscriptions;
      try {
        inscriptions = await this.archiveService.getInscriptions(current.symbol);
      } catch (err) {
        Logger.error(`Failed to load inscriptions for ${current.symbol}: ${err}`);
        pool.splice(idx, 1);
        continue;
      }

      // Keep only image-content inscriptions; drop ones already claimed.
      const candidatesIds = inscriptions
        .filter(i => this.isImageContentType(i.contentType))
        .map(i => i.id)
        .filter(id => !claimedTokenIds.has(id));

      if (candidatesIds.length >= this.TOKEN_GOAL) {
        this.shuffleArray(candidatesIds);
        return {
          tokenIds: candidatesIds.slice(0, this.TOKEN_GOAL),
          collectionName: current.name,
          collectionSymbol: current.symbol,
        };
      }

      // Not enough unclaimed images here — try another collection.
      pool.splice(idx, 1);
    }

    throw new Error('Could not find enough unclaimed tokens!');
  }

  // TODO: iframe! (one day)
  // check all possible content types here:
  // see: https://github.com/ordinals/ord/blob/05c10a73f2d29838b894e3c56849762dbe6dc51c/src/media.rs#L20
  isImageContentType(contentType: string): boolean {
    const supportedTypes = [
      'image/apng',
      'image/avif',
      'image/gif',
      'image/jpeg',
      'image/png',
      // 'image/svg+xml', too much troubles, too much black cubes
      'image/webp',
      'image/bmp',  // let's assume someone is crazy enough to do this :D
    ];
    return supportedTypes.includes(contentType);
  }

  /**
   * Randomize array in-place using Durstenfeld shuffle algorithm.
   * https://stackoverflow.com/a/12646864
   */
  shuffleArray<T>(array: T[]) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
