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

  // Separate build targets; nothing else compares them.
  it('gives each shipped environment the chain it declares', () => {
    expect(networkOf(regtestEnvironment)).toBe(Network.Regtest);
    expect(networkOf(environment)).toBe(Network.Mainnet);
    expect(networkOf(prodEnvironment)).toBe(Network.Mainnet);
  });

  it('treats an unrecognised value as mainnet, never as regtest', () => {
    // Mainnet is the safe fallback: regtest mode on mainnet would hand a user
    // an address their chain cannot pay.
    expect(networkOf({ network: '' as 'mainnet' })).toBe(Network.Mainnet);
  });
});
