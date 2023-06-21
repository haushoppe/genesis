import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-nft-display-list',
  templateUrl: './nft-display-list.component.html',
  styleUrls: ['./nft-display-list.component.scss'],
  standalone: true,
  imports: [
    RouterLink,
    NgOptimizedImage
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NftDisplayListComponent {

  @Input() nft?: any
}
