import { AsyncPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { Component, HostBinding } from '@angular/core';

import { BackendService } from '../shared/backend.service';
import { LoadingIndicatorComponent } from './loading-indicator/loading-indicator.component';

@Component({
  selector: 'app-scales',
  templateUrl: './scales.component.html',
  styleUrls: ['./scales.component.scss'],
  standalone: true,
  imports: [
    AsyncPipe,
    LoadingIndicatorComponent,
    NgClass,
    NgFor,
    NgIf
  ],
})
export class ScalesComponent {

  @HostBinding('class') class = 'px-3';

  groupedgroupedScales$ = this.backend.getAllGroupedScales();

  constructor(private backend: BackendService) { }



}
