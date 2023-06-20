import { JsonPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, Input } from '@angular/core';
import { PushModule } from '@rx-angular/template/push';

import { SafeHtmlPipe } from '../../safe-html.pipe';
import { MintService } from '../../services/mint-service';
import { SixInscriptionIds } from '../../store/mint.reducer';

@Component({
  selector: 'app-cube-preview',
  templateUrl: './cube-preview.component.html',
  styleUrls: ['./cube-preview.component.scss'],
  standalone: true,
  imports: [
    NgIf,
    PushModule,
    SafeHtmlPipe,
    JsonPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CubePreviewComponent {

  @Input() inscriptionIds: SixInscriptionIds = { };

  mintService = inject(MintService);
}
