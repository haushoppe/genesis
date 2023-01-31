import { Component, Input } from '@angular/core';
import { Metadata } from '../openapi-client';

@Component({
  selector: 'app-nft-display-list',
  templateUrl: './nft-display-list.component.html',
  styleUrls: ['./nft-display-list.component.scss'],
  standalone: true
})
export class NftDisplayListComponent {

  @Input() nft?: Metadata
}
