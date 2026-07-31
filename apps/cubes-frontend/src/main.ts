import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { getAddressFormat, getAddressNetwork } from 'ordpool-sdk';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
  // Fail-fast if the build-time env injection (scripts/inject-env.mjs
  // + CI secret HAUSHOPPE_TIP_ADDRESS) didn't land a real mainnet
  // Taproot address. Silent shipping of a placeholder is a mint-
  // breaking bug that the E2E regtest suite can't catch (regtest
  // uses environment.regtest.ts with a bcrt1p address). Assert here
  // so the SPA refuses to boot instead of showing a broken mint UI.
  const tip = environment.haushoppeTipAddress;
  let format: string | undefined;
  let network: string | undefined;
  try {
    format = getAddressFormat(tip);
    network = getAddressNetwork(tip);
  } catch (err) {
    throw new Error(
      `cubes-frontend prod boot: haushoppeTipAddress "${tip}" does not decode as a Bitcoin address. ` +
      `The HAUSHOPPE_TIP_ADDRESS CI secret is missing or malformed. Underlying error: ${(err as Error).message}`,
    );
  }
  if (format !== 'P2TR' || network !== 'mainnet') {
    throw new Error(
      `cubes-frontend prod boot: haushoppeTipAddress "${tip}" is ${format}/${network}, expected P2TR/mainnet. ` +
      `Check the HAUSHOPPE_TIP_ADDRESS CI secret.`,
    );
  }
}

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
