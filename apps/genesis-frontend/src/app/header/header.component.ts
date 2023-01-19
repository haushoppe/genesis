import { CommonModule } from '@angular/common';
import { Component, HostBinding } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  selector: 'header',
  standalone: true,
  imports: [CommonModule, RouterModule],
})
export class HeaderComponent {
  @HostBinding('class') class = 'header-height';
}
