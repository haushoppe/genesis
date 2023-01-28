import { Component, HostBinding } from '@angular/core';

@Component({
  selector: 'app-banner',
  templateUrl: './banner.component.html',
  styleUrls: ['./banner.component.scss'],
  standalone: true
})
export class BannerComponent {
  @HostBinding('class') class = '';
}
