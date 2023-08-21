import { JsonPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, Input } from '@angular/core';
import { PushModule } from '@rx-angular/template/push';

import { MintService } from '../../services/mint-service';
import { SafeHtmlPipe } from '../../safe-html.pipe';
import { CubeDetails } from '../../store/mint.actions';

@Component({
  selector: 'app-cube-preview',
  templateUrl: './cube-preview.component.html',
  styleUrls: ['./cube-preview.component.scss'],
  standalone: true,
  imports: [
    NgIf,
    PushModule,
    JsonPipe,
    SafeHtmlPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CubePreviewComponent {

  @Input() cubeDetails: CubeDetails = {
    inscriptionIds: {
      inscriptionId1: '',
      inscriptionId2: '',
      inscriptionId3: '',
      inscriptionId4: '',
      inscriptionId5: '',
      inscriptionId6: ''
    },
    rotationSpeedX: '',
    rotationSpeedY: '',
    colorPane: '',
    bgColor1: '',
    bgColor2: ''
  };

  mintService = inject(MintService);
}
