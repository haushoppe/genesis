import { Component, HostBinding } from '@angular/core';
import { RouterLinkActive } from '@angular/router';

@Component({
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  selector: 'header',
  standalone: true,
  imports: [RouterLinkActive, RouterLinkActive]
})
export class HeaderComponent {
  @HostBinding('class') class = 'header-height';
}
