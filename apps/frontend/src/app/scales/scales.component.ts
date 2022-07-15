import { CommonModule } from '@angular/common';
import { Component, HostBinding } from '@angular/core';
import { BackendService } from '../shared/backend.service';
import { LoadingIndicatorComponent } from './loading-indicator/loading-indicator.component';

@Component({
  selector: 'app-scales',
  standalone: true,
  imports: [CommonModule, LoadingIndicatorComponent],
  templateUrl: './scales.component.html',
  styleUrls: ['./scales.component.scss']
})
export class ScalesComponent {

  @HostBinding('class') class = 'px-3';

  groupedgroupedScales$ = this.backend.getAllGroupedScales();

  constructor(private backend: BackendService) { }



}
