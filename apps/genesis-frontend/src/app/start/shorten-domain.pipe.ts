import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'shortenDomain',
  standalone: true
})
export class ShortenDomainPipe implements PipeTransform  {

   transform(domain: string | undefined | null): string {
    if (!domain) return '';
    return shortenDomain(domain);
   }
}

// from https://github.com/blocknative/web3-onboard/blob/d7c037b2d0e5e6ec50b5e7b5177bc444e61d1aa3/packages/core/src/utils.ts#L84
export function shortenDomain(domain: string): string {
  return domain.length > 11
    ? `${domain.slice(0, 4)}...${domain.slice(-6)}`
    : domain
}
