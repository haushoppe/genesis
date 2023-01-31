import { Component, HostBinding, ViewEncapsulation } from '@angular/core';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';

@Component({
  selector: 'app-banner',
  templateUrl: './banner.component.html',
  styleUrls: ['./banner.component.scss'],
  standalone: true,
  encapsulation: ViewEncapsulation.None
})
export class BannerComponent {

  bannerImages = [
    'https://assets.haushoppe.art/genesis/genesis1/7colors.jpg',
    'https://assets.haushoppe.art/genesis/genesis2/5colors.jpg',
    'https://assets.haushoppe.art/genesis/genesis3/6colors.jpg',
    'https://assets.haushoppe.art/genesis/genesis4/5colors.jpg'
  ];

  randomImage = this.bannerImages[Math.floor(Math.random() * this.bannerImages.length)];

  @HostBinding('attr.style')
  get myStyle(): SafeStyle {
    return this.sanitizer.bypassSecurityTrustStyle(`--banner-image: url("${ this.randomImage }")`);
  }

  constructor(private sanitizer: DomSanitizer) {}
}
