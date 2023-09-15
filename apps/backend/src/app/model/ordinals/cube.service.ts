import { Injectable } from '@nestjs/common';
import { MagicEdenService } from './magic-eden.service';  // assuming the service is in the same folder, otherwise adjust the path
import { CubeSuggestion } from '../../types/ordinals/cube-suggestion';
import { CollectionDetails, CollectionStat } from '../../types/ordinals/types-magic-eden';

@Injectable()
export class CubeService {


  constructor(private magicEdenService: MagicEdenService) {}

}
