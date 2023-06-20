import { Injectable } from '@angular/core';

import { environment } from '../../environments/environment';




@Injectable({
  providedIn: 'root'
})
export class MintService {

  async mint(inscriptionIds: string[]): Promise<void> {

    return Promise.reject();
  }
}
