import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ShortenNamePipe } from './shorten-name.pipe';
import { ShortenAddressPipe } from './shorten-address.pipe';
import { BlockyIdenticonComponent } from './blocky/blocky-identicon.component';

@Component({
  selector: 'app-address-display',
  templateUrl: './address-display.component.html',
  styleUrls: ['./address-display.component.scss'],
  standalone: true,
  imports: [
    NgIf,
    ShortenNamePipe,
    ShortenAddressPipe,
    BlockyIdenticonComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddressDisplayComponent {

  @Input() name?: string;
  @Input() address?: string;

}
