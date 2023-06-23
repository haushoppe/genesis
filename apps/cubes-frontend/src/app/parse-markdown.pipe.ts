import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Pipe, PipeTransform } from '@angular/core';
import { marked } from 'marked';

@Pipe({
  name: 'parseMarkdown',
  standalone: true
})
export class ParseMarkdownPipe implements PipeTransform  {

   constructor(private sanitizer: DomSanitizer) { }

   transform(markdown: string): SafeHtml {
    const html = marked.parse(markdown);
    const sanitizedHtml = this.sanitizer.bypassSecurityTrustHtml(html);
    return sanitizedHtml;
   }
}
