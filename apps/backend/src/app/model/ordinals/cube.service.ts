import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import { parseCube } from '../../../../../shared/parse-cube';
import { InscriptionSimple } from '../../types/ordinals/inscription-simple';
import { searchForText } from './ordinalsbot';
import { ordinalnovusSearchForText } from '../../../../../shared/ordinalnovus';
import { LooksLikeOrdinalsbotInscription } from '../../../../..//shared/ordinalnovus-inscription-search-result';
import { getInscriptionFromHiro, getInscriptionContentFromHiro } from '../../../../../shared/hiro';
import { OrdinalsbotInscription } from 'apps/shared/ordinalsbot-inscription-search-result';


@Injectable()
export class CubeService {

  private allCubes: InscriptionSimple[] = [];

  /**
   * Performing async tasks before controllers are available
   */
  async onModuleInit() {
    Logger.log('Initializing CubeService', 'ordinal_cubes');
    await this.handleInterval(); // immediate execution upon module initialization

    Logger.verbose('Fetched ' + this.allCubes.length + ' cubes', 'ordinal_cubes');
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

    let ordinalsbotResultFiltered: OrdinalsbotInscription[] = [];
    let ordinalnovusFiltered: LooksLikeOrdinalsbotInscription[] = [];

    try {

      const searchResultOrdinalsbot = (await searchForText('cubes.haushoppe.art')).results;
      ordinalsbotResultFiltered = searchResultOrdinalsbot
        .filter(x => x.contentstr.includes('<html><!--cubes.haushoppe.art-->'));

      // fix Result! (inscriptionnumber always NULL)
      await Promise.all(
        ordinalsbotResultFiltered.map(async x => {
          const hiroInscription = await getInscriptionFromHiro(x.inscriptionid)
          x.inscriptionnumber = hiroInscription.number;
        })
      );
      ordinalsbotResultFiltered.sort((a, b) => a.inscriptionnumber - b.inscriptionnumber);
      Logger.log("Amount of cubes found by Ordinalsbot: " + ordinalsbotResultFiltered.length);

    } catch (ex: unknown) {
      Logger.warn('Error loading cubes via Ordinalsbot!' + ex, 'ordinal_cubes');
    }

    try {

      const searchResultOrdinalnovus = await ordinalnovusSearchForText('cubes.haushoppe.art');
      ordinalnovusFiltered = searchResultOrdinalnovus
        .filter(x => x.contentstr.includes('<html><!--cubes.haushoppe.art-->'));

      // fix Result! (contentString has cloudflare snippet)
      await Promise.all(
        ordinalnovusFiltered.map(async x => {
          const hiroInscriptionContent = await getInscriptionContentFromHiro(x.inscriptionid)
          x.contentstr = hiroInscriptionContent;
        })
      );
      ordinalnovusFiltered.sort((a, b) => a.inscriptionnumber - b.inscriptionnumber);
      Logger.log("Amount of cubes found by Ordinalnovus: " + ordinalnovusFiltered.length);

    } catch (ex: unknown) {
      Logger.warn('Error loading cubes via Ordinalnovus!' + ex, 'ordinal_cubes');
    }

    if (ordinalsbotResultFiltered.length >= ordinalnovusFiltered.length) {
      Logger.log("Using Ordinalsbot!");
      this.allCubes = this.searchResultToCubeInscriptionMeta(ordinalsbotResultFiltered);
    } else {
      Logger.log("Using Ordinalnovus!");
      this.allCubes = this.searchResultToCubeInscriptionMeta(ordinalnovusFiltered);
    }
  }

  private searchResultToCubeInscriptionMeta(searchResultsFiltered: LooksLikeOrdinalsbotInscription[]): InscriptionSimple[] {

    const meta = searchResultsFiltered

      // get attributes OR null for invalid cubes
      .map(x => {
        const attributes = parseCube(x.contentstr);
        if (attributes) {
          // console.log(x);
          return {
            inscriptionId: x.inscriptionid,
            // inscriptionNumber: x.inscriptionnumber,
            attributes
          }
        }
        console.log('Invalid cube! ' + x.inscriptionid + ' --- ' + x.contentstr);
        return null;
      })

      // remove invalid cubes
      .filter(x => !!x)

      // assemble Metadata
      .map((x, index) => {

        let name = 'Ordinal Cube #' + index;

        const titleTrait = x.attributes.find(t => t.trait_type === 'Title');
        if (titleTrait) {
          name = `${name} (${titleTrait.value})`
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
