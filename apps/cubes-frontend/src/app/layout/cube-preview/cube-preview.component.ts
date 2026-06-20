import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
} from '@angular/core';

import { SafeHtmlPipe } from '../../safe-html.pipe';
import { MintFacade } from '../../store/mint.facade';

@Component({
  selector: 'app-cube-preview',
  templateUrl: './cube-preview.component.html',
  styleUrls: ['./cube-preview.component.scss'],
  imports: [SafeHtmlPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CubePreviewComponent {
  @Input() cubeDetails = {
    inscriptionIds: {
      inscriptionId1: '',
      inscriptionId2: '',
      inscriptionId3: '',
      inscriptionId4: '',
      inscriptionId5: '',
      inscriptionId6: '',
    },
    // title: '', // without Title!
    rotationSpeedX: '',
    rotationSpeedY: '',
    colorPane: '',
    bgColor1: '',
    bgColor2: '',
  };

  get cubeDetailsWithMockedTitle() {
    return {
      ...this.cubeDetails,
      title: '',
    };
  }

  mintFacade = inject(MintFacade);
}
