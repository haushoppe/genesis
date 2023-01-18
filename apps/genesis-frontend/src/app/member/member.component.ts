import { CommonModule } from '@angular/common';
import { Component, HostBinding } from '@angular/core';
import { LoadingIndicatorComponent } from './loading-indicator/loading-indicator.component';

@Component({
  selector: 'app-scales',
  standalone: true,
  imports: [CommonModule, LoadingIndicatorComponent],
  templateUrl: './member.component.html',
  styleUrls: ['./member.component.scss']
})
export class MemberComponent {

  @HostBinding('class') class = 'px-3';




}
