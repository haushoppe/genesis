import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'shortenAddress',
  standalone: true
})
export class ShortenAddressPipe implements PipeTransform  {

   transform(address: string | undefined | null): string {
    if (!address) return '';
    return shortenAddress(address);
   }
}

// from https://github.com/blocknative/web3-onboard/blob/d7c037b2d0e5e6ec50b5e7b5177bc444e61d1aa3/packages/core/src/utils.ts#L80
export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
