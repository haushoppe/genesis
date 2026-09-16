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
  // `proxy.conf.regtest.json` maps `/api/*` → `http://localhost:3010/*`
  // (stripping the `/api` prefix, since electrs's Esplora endpoints
  // live at the root — /address/{}/utxo, /tx, /tx/{}/hex, etc.).
  mempoolApiUrl: '',
  // The side ids the specs mint with are mainnet inscriptions (like the cube
  // renderer itself), so the mint form's black-face check loads them from
  // mainnet content, the same host prod probes.
  //
  // This is the one reach outside the regtest stack, and it is deliberately no
  // longer load-bearing: a probe that cannot finish answers `unknown`, which
  // does not gate the Mint button (`side-image-check.ts`). Blocked or slow CI
  // egress therefore costs the specs a few seconds, not seven red runs
  // attributed to whatever wallet happened to be under test.
  sideImageProbeBase: 'https://api.ordpool.space',
  // The SDK UtxoContentScanner's funding-safety scan hits both real regtest ord
  // instances the docker stack brings up: ordApiUrl -> stock ord (:8081,
  // --index-sats; inscriptions/runes/rare-sats) and cat21OrdApiUrl -> cat21-ord
  // (:8080, --index-cat21; cats). A funding coin auto-picks only when BOTH report
  // no inscription, rune, cat, or rare sat. The specs fund via `fundCommonSats`
  // so the payment lands on common mid-block sats: a raw coinbase's block-first
  // sat reads as an "uncommon" rare sat, which would (correctly) force expert-mode.
  ordApiUrl: 'http://localhost:8081',
  cat21OrdApiUrl: 'http://localhost:8080',
  haushoppeTipAddress: 'bcrt1pgnmqsy3m04999vwvczfuuualuptlcwnlqx7yrf7y2xwzyswdxpvq92zqwq',
  haushoppeTipSats: 1000,
  ordinalsExplorerIframe: 'http://localhost:8081/preview/',
  // Witness-capable preview = the real ordpool-backend in the regtest stack
  // (docker-compose.regtest.yml, `ordpool-backend` profile, port 8999). It
  // renders a cube from the mempool witness before any block is mined, the
  // same path prod's api.ordpool.space/preview uses. stock-ord (:8081 above)
  // only serves confirmed inscriptions, so the mempool preview needs this.
  ownPreviewIframe: 'http://127.0.0.1:8999/preview/',
  ordinalsExplorerDetails: 'http://localhost:8081/inscription/',
  satflowMarketplace: 'https://www.satflow.com/ordinal/',
  ordNetMarketplace: 'https://ord.net/inscription/'
};
