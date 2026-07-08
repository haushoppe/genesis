/**
 * Regtest environment — e2e/regtest/ specs boot the frontend with this.
 * mempoolApiUrl points at the local electrs container the docker-compose
 * stack brings up; the tip address is a bcrt1p… so the reveal's vout[1]
 * doesn't dust-reject on regtest, and the amount is set well above the
 * P2TR 330-sat floor for safety.
 *
 * bcrt1p… derived from BIP-39 abandon×11+about at m/86'/1'/0'/0/0
 * (regtest = testnet-derivation-path). Anyone can spend from this
 * address; that is fine — it exists on regtest only.
 */
export const environment = {
  production: false,
  api: 'http://localhost:3333',
  // Same-origin so the dev-server proxy handles CORS + path rewrites:
  // `proxy.conf.regtest.json` maps `/api/*` → `http://localhost:3000/*`
  // (stripping the `/api` prefix, since electrs's Esplora endpoints
  // live at the root — /address/{}/utxo, /tx, /tx/{}/hex, etc.).
  mempoolApiUrl: '',
  haushoppeTipAddress: 'bcrt1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqp3mvzv',
  haushoppeTipSats: 1000,
  ordinalsExplorerIframe: 'http://localhost:8081/preview/',
  ordinalsExplorerDetails: 'http://localhost:8081/inscription/',
  satflowMarketplace: 'https://www.satflow.com/ordinal/',
  ordNetMarketplace: 'https://ord.net/inscription/'
};
