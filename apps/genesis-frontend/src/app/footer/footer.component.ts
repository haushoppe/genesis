import { Component, HostBinding } from '@angular/core';

@Component({
  selector: 'footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  standalone: true
})
export class FooterComponent {
  @HostBinding('class') class = 'mt-auto';
}
