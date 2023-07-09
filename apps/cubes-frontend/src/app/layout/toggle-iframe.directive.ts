import { Directive, ElementRef, OnInit, OnDestroy, Input } from '@angular/core';

@Directive({
  selector: '[appToggleIframe]',
  standalone: true
})
export class ToggleIframeDirective implements OnInit, OnDestroy {

  @Input('appToggleIframe') src = '';
  private intersectionObserver: IntersectionObserver | undefined;

  constructor(private element: ElementRef) { }

  ngOnInit() {
    this.intersectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.element.nativeElement.src = this.src;
        } else {
          this.element.nativeElement.src = '/assets/placeholder.html';
        }
      });
    });

    this.intersectionObserver.observe(this.element.nativeElement);
  }

  ngOnDestroy() {
    this.intersectionObserver?.disconnect();
  }

}
