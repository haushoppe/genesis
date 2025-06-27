import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import { parseCube } from '../../../../../shared/ordinals/parse-cube';
import { InscriptionExtended } from '../../types/ordinals/inscription-extended';
import { searchForText } from './ordinalsbot';
import { getInscriptionFromOrd } from '../../../../../shared/ordinals/ord';
import { OrdinalsbotInscription } from '../../../../../shared/ordinals/ordinalsbot-inscription-search-result';
import { sortInscriptions } from './inscription-helper';
import { ConfigService } from '@nestjs/config';


@Injectable()
export class CubeService {

  private allCubes: InscriptionExtended[] = [];
  private ordinalsbotApiKey: string;

  constructor(private configService: ConfigService) {
    this.ordinalsbotApiKey = this.configService.get<string>('ORDINALSBOT_API_KEY');
  }

  /**
   * Performing async tasks before controllers are available
   */
  async onModuleInit() {
    Logger.log('Initializing CubeService. First run will be in 5 minutes', 'ordinal_cubes');
  }

  @Interval(1000 * 60 * 5) // every 5 minutes
  async handleInterval() {
    await this.serchForAllCubes();
  }

  /**
   * Retrieves all known cubes (cached)
   */
  async getAllCubes(): Promise<InscriptionExtended[]> {
    return Promise.resolve(this.allCubes);
  }

  /**
   * Uses the OrdinalsBot API to search for the string cubes.haushoppe.art
   * Filters invalid data
   */
  private async serchForAllCubes() {

    const ordinalsbotResultFiltered = await this.searchAndFilterViaOrdinalsBot();
    const newInscriptionExtended = this.searchResultToCubeInscriptionMeta(ordinalsbotResultFiltered);

    if (this.allCubes.length < newInscriptionExtended.length) {
      Logger.log(`Updating cached cubes!`);
      this.allCubes = newInscriptionExtended;
    }
  }

  /**
   * Returns empty array on any error!
   */
  private async searchAndFilterViaOrdinalsBot(): Promise<OrdinalsbotInscription[]> {
    try {

      const searchResult = (await searchForText('cubes.haushoppe.art', this.ordinalsbotApiKey));
      const filtered = searchResult.filter(x => x.contentstr.includes('<html><!--cubes.haushoppe.art-->'));

      // fix Result! (inscriptionnumber always NULL)
      await Promise.all(
        filtered.map(async (x) => {
          const ordInscription = await getInscriptionFromOrd(x.inscriptionid);
          // console.log(ordInscription);
          x.inscriptionnumber = ordInscription.inscriptionNumber;

          // they now also screwed this up with a nasty cloudflare snipped
          x.contentstr = x.contentstr.replace(/<script defer.*/, '');
        })
      );

      sortInscriptions(filtered);
      Logger.log("Amount of cubes found by Ordinalsbot: " + filtered.length);
      // ordinalsbotResultFiltered.forEach(x => console.log(x.inscriptionnumber));

      return filtered;

    } catch (ex: unknown) {
      Logger.warn('Error loading cubes via Ordinalsbot!' + ex, 'ordinal_cubes');
      console.log(ex);
      return [];
    }
  }

  private searchResultToCubeInscriptionMeta(searchResultsFiltered: OrdinalsbotInscription[]): InscriptionExtended[] {

    const meta = searchResultsFiltered

      // get attributes OR null for invalid cubes
      .map(x => {
        const attributes = parseCube(x.contentstr);
        if (attributes) {
          // console.log(x);
          return {
            inscriptionId: x.inscriptionid,
            inscriptionNumber: x.inscriptionnumber,
            blockHeight: x.blockheight,
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
          inscriptionNumber: x.inscriptionNumber,
          blockHeight: x.blockHeight,
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
