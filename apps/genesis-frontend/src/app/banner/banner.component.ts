import { CommonModule, NgClass } from '@angular/common';
import { Component, HostBinding } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-banner',
  templateUrl: './banner.component.html',
  styleUrls: ['./banner.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, NgClass],

})
export class BannerComponent {
  @HostBinding('class') class = '';
}
