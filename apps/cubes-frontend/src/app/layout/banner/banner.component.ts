import { NgFor } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostBinding } from '@angular/core';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';

@Component({
  selector: 'app-banner',
  templateUrl: './banner.component.html',
  styleUrls: ['./banner.component.scss'],
  standalone: true,
  imports: [NgFor],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BannerComponent {

  bannerImages = [
    '/assets/cubes.jpg'
  ];

  randomImage = this.pickRandomImage();

  @HostBinding('attr.style')
  get myStyle(): SafeStyle {
    return this.sanitizer.bypassSecurityTrustStyle(`--banner-image: url("${ this.randomImage }")`);
  }

  constructor(private sanitizer: DomSanitizer, changeDetector: ChangeDetectorRef) {
    // setInterval(() => {
    //   this.randomImage = this.pickRandomImage();
    //   // console.log('Change image to:', this.randomImage);

    //   // calling detectChanges does not have any effect because host bindings are part of parent view.
    //   changeDetector.markForCheck();
    // }, 1000 * 10);
    // this.preloadImages();
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
