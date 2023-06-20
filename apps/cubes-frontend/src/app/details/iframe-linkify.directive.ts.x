import { Directive, ElementRef, HostListener, OnInit, inject } from "@angular/core";
import { Router } from "@angular/router";


/**
 *  Apply Angular Routing behavior for own host for an iframe
 */
@Directive({
  selector: "[appIframeLinkify]",
  standalone: true
})
export class IframeLinkifyDirective implements OnInit {
  constructor(private el: ElementRef) {}

  ngOnInit(): void {
    const iframe = this.el.nativeElement as HTMLIFrameElement;

    iframe.addEventListener('load', () => {
      const iframeDocument = iframe.contentWindow?.document;
      if (!iframeDocument) {
        return;
      }

      iframeDocument.querySelectorAll("a[target='_top']").forEach((link_) => {

        const link = link_ as HTMLAnchorElement;
        link.addEventListener('click', (event: MouseEvent) => {

          event.preventDefault();
          console.log('Link clicked:', link.href);
          debugger;


        });
      });
    });
  }
}
