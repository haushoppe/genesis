import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  selector: 'header',
  imports: [
    RouterLink,
  ],
  
})
export class HeaderComponent { }
