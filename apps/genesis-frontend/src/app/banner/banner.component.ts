import { NgFor } from '@angular/common';
import { Component, HostBinding, ViewEncapsulation } from '@angular/core';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';

@Component({
  selector: 'app-banner',
  templateUrl: './banner.component.html',
  styleUrls: ['./banner.component.scss'],
  standalone: true,
  imports: [NgFor]
})
export class BannerComponent {

  bannerImages = [
    'https://assets.haushoppe.art/genesis/genesis1/7colors.jpg',
    'https://assets.haushoppe.art/genesis/genesis2/5colors.jpg',
    'https://assets.haushoppe.art/genesis/genesis3/6colors.jpg',
    'https://assets.haushoppe.art/genesis/genesis4/5colors.jpg'
  ];

  randomImage = this.pickRandomImage();


  @HostBinding('attr.style')
  get myStyle(): SafeStyle {
    return this.sanitizer.bypassSecurityTrustStyle(`--banner-image: url("${ this.randomImage }")`);
  }

  constructor(private sanitizer: DomSanitizer) {
    setInterval(() => this.randomImage = this.pickRandomImage(), 1000 * 10);
    this.preloadImages();
  }

  pickRandomImage() {
    return this.bannerImages[Math.floor(Math.random() * this.bannerImages.length)];
  }

  preloadImages(){
    for(let i = 0; i < this.bannerImages.length; i++){
      const img = new Image();
      img.src = this.bannerImages[i];
    }
  }
}
