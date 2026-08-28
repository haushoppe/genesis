/**
 * Regtest environment — e2e/regtest/ specs boot the frontend with this.
 * mempoolApiUrl points at the local electrs container the docker-compose
 * stack brings up; the tip address is a valid bcrt1p bech32m taproot so
 * the reveal's vout[1] doesn't dust-reject on regtest and the reveal
 * builder's decode step doesn't throw.
 *
 * The previous value used `tb`-computed checksum bytes with the `bcrt`
 * HRP swapped in — bech32/bech32m both rejected the resulting address
 * with "Invalid checksum … expected vg32hk", which surfaced inside
 * InscribeMintOrchestrator.computeSimulations and marked every UTXO
 * as `insufficient` (masking the real crash). Corrected to the same
 * data words re-encoded under `bcrt` HRP; the last six chars now match
 * the expected bech32m checksum for this pubkey under regtest.
 */
export const environment = {
  production: false,
  api: 'http://localhost:3333',
  // Same-origin so the dev-server proxy handles CORS + path rewrites:
  // `proxy.conf.regtest.json` maps `/api/*` → `http://localhost:3000/*`
  // (stripping the `/api` prefix, since electrs's Esplora endpoints
  // live at the root — /address/{}/utxo, /tx, /tx/{}/hex, etc.).
  mempoolApiUrl: '',
  haushoppeTipAddress: 'bcrt1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqvg32hk',
  haushoppeTipSats: 1000,
  ordinalsExplorerIframe: 'http://localhost:8081/preview/',
  ordinalsExplorerDetails: 'http://localhost:8081/inscription/',
  satflowMarketplace: 'https://www.satflow.com/ordinal/',
  ordNetMarketplace: 'https://ord.net/inscription/'
};
