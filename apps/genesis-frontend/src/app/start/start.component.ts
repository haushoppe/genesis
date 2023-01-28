import { Component, HostBinding } from '@angular/core';

@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  styleUrls: ['./start.component.scss'],
  standalone: true,
  imports: []
})
export class StartComponent {
  @HostBinding('class') class = 'px-3';
}
