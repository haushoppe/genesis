import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'shortenName',
  standalone: true
})
export class ShortenNamePipe implements PipeTransform  {

   transform(name: string | undefined | null): string {
    if (!name) return '';
    return shortenName(name);
   }
}

// from https://github.com/blocknative/web3-onboard/blob/d7c037b2d0e5e6ec50b5e7b5177bc444e61d1aa3/packages/core/src/utils.ts#L84
export function shortenName(name: string): string {
  // no shortening for now...

  // return name.length > 11
  //   ? `${name.slice(0, 4)}...${name.slice(-6)}`
  //   : name
  return name;
}
