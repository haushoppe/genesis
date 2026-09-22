import { Network } from 'ordpool-sdk';

import { networkOf } from './app.config';
import { environment } from '../environments/environment';
import { environment as regtestEnvironment } from '../environments/environment.regtest';
import { environment as prodEnvironment } from '../environments/environment.prod';

describe('networkOf', () => {
  it('reads regtest from the declared field', () => {
    expect(networkOf({ network: 'regtest' })).toBe(Network.Regtest);
  });

  it('reads mainnet from the declared field', () => {
    expect(networkOf({ network: 'mainnet' })).toBe(Network.Mainnet);
  });

  // Each environment file is a separate build target, so nothing else compares
  // them against each other. The regtest one is the branch that matters: a
  // build that reads mainnet there produces bc1 addresses against a regtest
  // chain, and every symptom of that appears somewhere other than the address.
  it('gives each shipped environment the chain it declares', () => {
    expect(networkOf(regtestEnvironment)).toBe(Network.Regtest);
    expect(networkOf(environment)).toBe(Network.Mainnet);
    expect(networkOf(prodEnvironment)).toBe(Network.Mainnet);
  });

  it('treats an unrecognised value as mainnet, never as regtest', () => {
    // The fallback direction is deliberate. Mainnet is the conservative
    // answer: an app wrongly in mainnet mode on regtest fails visibly on the
    // first address it builds, while one wrongly in regtest mode on mainnet
    // would hand a user an address their own chain cannot pay.
    expect(networkOf({ network: '' as 'mainnet' })).toBe(Network.Mainnet);
  });
});
