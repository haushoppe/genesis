import { Component } from '@angular/core';

import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';

@Component({
  selector: 'app-details',
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss'],
  standalone: true,
  imports: [LoadingIndicatorComponent]
})
export class DetailsComponent {
}
