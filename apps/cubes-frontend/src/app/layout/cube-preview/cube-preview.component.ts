import { Component, computed, inject, input } from '@angular/core';

import { SafeHtmlPipe } from '../../safe-html.pipe';
import { MintFacade } from '../../store/mint.facade';

interface CubeDetailsInput {
  inscriptionIds: {
    inscriptionId1: string;
    inscriptionId2: string;
    inscriptionId3: string;
    inscriptionId4: string;
    inscriptionId5: string;
    inscriptionId6: string;
  };
  rotationSpeedX: string;
  rotationSpeedY: string;
  colorPane: string;
  bgColor1: string;
  bgColor2: string;
}

const DEFAULT_CUBE_DETAILS: CubeDetailsInput = {
  inscriptionIds: {
    inscriptionId1: '',
    inscriptionId2: '',
    inscriptionId3: '',
    inscriptionId4: '',
    inscriptionId5: '',
    inscriptionId6: '',
  },
  rotationSpeedX: '',
  rotationSpeedY: '',
  colorPane: '',
  bgColor1: '',
  bgColor2: '',
};

@Component({
  selector: 'app-cube-preview',
  templateUrl: './cube-preview.component.html',
  styleUrls: ['./cube-preview.component.scss'],
  imports: [SafeHtmlPipe],
})
export class CubePreviewComponent {
  readonly cubeDetails = input<CubeDetailsInput>(DEFAULT_CUBE_DETAILS);

  protected readonly cubeDetailsWithMockedTitle = computed(() => ({
    ...this.cubeDetails(),
    title: '',
  }));

  protected readonly mintFacade = inject(MintFacade);
}
