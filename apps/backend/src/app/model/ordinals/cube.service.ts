import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import { OrdinalsbotInscriptionSearchResult } from '../../../../../shared/ordinalsbot-inscription-search-result';
import { parseCube } from '../../../../../shared/parse-cube';
import { InscriptionSimple } from '../../types/ordinals/inscription-simple';
import { searchForText } from './ordinalsbot';


@Injectable()
export class CubeService {

  private allCubes: InscriptionSimple[] = [];

  /**
   * Performing async tasks before controllers are available
   */
  async onModuleInit() {
    Logger.log('Initializing CubeService', 'ordinals_cubes');
    await this.handleInterval(); // immediate execution upon module initialization

    Logger.verbose('Fetched ' + this.allCubes.length + ' cubes', 'ordinals_cubes');
  }

  @Interval(1000 * 60 * 5) // every 5 minutes
  async handleInterval() {
    await this.serchForAllCubes();
  }

  /**
   * Retrieves all known cubes (cached)
   */
  async getAllCubes(): Promise<InscriptionSimple[]> {
    return Promise.resolve(this.allCubes);
  }

  /**
   * Uses the OrdinalsBot API to search for the string cubes.haushoppe.art
   * Filters invalid data
   */
  private async serchForAllCubes() {
    const searchResult = await searchForText('cubes.haushoppe.art');
    this.allCubes = this.searchResultToCubeInscriptionMeta(searchResult);
  }

  private searchResultToCubeInscriptionMeta(searchResult: OrdinalsbotInscriptionSearchResult): InscriptionSimple[] {

    const meta = searchResult.results

      // filter all out without correct prefex
      .filter(x => x.contentstr.includes('<html><!--cubes.haushoppe.art-->'))

      // get attributes OR null for invalid cubes
      .map(x => {
        const attributes = parseCube(x.contentstr);
        if (attributes) {
          return {
            inscriptionId: x.inscriptionid,
            attributes
          }
        }
        console.log('Invalid cube! ' +  x.inscriptionid);
        return null;
      })

      // remove invalid cubes
      .filter(x => !!x)

      // assemble Metadata
      .map((x, index) => {

        let name = 'Ordinal Cube #' + index;

        const titleTrait = x.attributes.find(t => t.trait_type === 'Title');
        if (titleTrait) {
          name = `${ name } (${ titleTrait.value })`
        }

        return {
          inscriptionId: x.inscriptionId,
          meta: {
            name,
            attributes: x.attributes
          }
        };
      }
    );

    return meta;
  }
}
