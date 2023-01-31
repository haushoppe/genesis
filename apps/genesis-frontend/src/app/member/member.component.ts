import { Component } from '@angular/core';

import { LoadingIndicatorComponent } from './loading-indicator/loading-indicator.component';

@Component({
  selector: 'app-scales',
  templateUrl: './member.component.html',
  styleUrls: ['./member.component.scss'],
  standalone: true,
  imports: [LoadingIndicatorComponent]
})
export class MemberComponent {
}
