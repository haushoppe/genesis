import { CommonModule } from '@angular/common';
import { Component, HostBinding } from '@angular/core';
import { BackendService } from '../shared/backend.service';

@Component({
  selector: 'app-scales',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scales.component.html',
  styleUrls: ['./scales.component.scss']
})
export class ScalesComponent {

  @HostBinding('class') class = 'px-3';

  groupedScales$ = this.backend.getAllGroupedScales();

  constructor(private backend: BackendService) { }



}
