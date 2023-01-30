import { Component, Input } from '@angular/core';
import { Metadata } from '../openapi-client';

@Component({
  selector: 'app-nft-display',
  templateUrl: './nft-display.component.html',
  styleUrls: ['./nft-display.component.scss'],
  standalone: true
})
export class NftDisplayComponent {

  @Input() nft?: Metadata
}
