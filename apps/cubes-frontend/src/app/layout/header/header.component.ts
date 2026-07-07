import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  selector: 'header',
  imports: [
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent { }
