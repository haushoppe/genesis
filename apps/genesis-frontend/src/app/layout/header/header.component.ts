import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  selector: 'header',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive
  ]
})
export class HeaderComponent {
}
