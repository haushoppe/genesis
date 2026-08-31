// Central-regtest environment: points the cubes frontend at the SHARED
// workspace regtest stack (workspace-root regtest/), whose host ports mirror
// the prod cloudflared tunnel targets. Serve with `ng serve -c central`, or
// `make cubes-fe` from regtest/.
//
// Distinct from environment.regtest.ts, which targets cubes-frontend's OWN
// e2e stack (its bitcoind/electrs/ord on standard ports). The central stack
// reuses OUR fork backends on prod-parity ports; this file points at those.
//
// URLs derive from the page's own hostname so one build works on localhost and
// via a LAN IP through the nginx dev-proxy. /api is same-origin, proxied to the
// ordpool-backend on :8999 (which proxies to electrs) — NOT :3000 directly,
// because that host port is shadowed. See proxy.conf.central.json.
const host = typeof location !== 'undefined' ? location.hostname : 'localhost';

export const environment = {
  production: false,
  // cat21-indexer backend (= backend2.cat21.space).
  api: `http://${host}:3333`,
  // Same-origin; proxied to ordpool-backend :8999 -> electrs (avoids :3000).
  mempoolApiUrl: '',
  // Full ord (= ord.ordpool.space) = the central ord-stock container.
  ordApiUrl: `http://${host}:3838`,
  // cat21-ord (= ord.cat21.space).
  cat21OrdApiUrl: `http://${host}:8080`,
  haushoppeTipAddress: 'bcrt1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqvg32hk',
  haushoppeTipSats: 1000,
  // The cube RENDERER inscription is a mainnet inscription, so its /content +
  // /preview load from ordinals.com even while the MINT happens on regtest
  // (see proxy.conf.central.json). Detail links point at the central full ord.
  ordinalsExplorerIframe: `http://${host}:3838/preview/`,
  ordinalsExplorerDetails: `http://${host}:3838/inscription/`,
  satflowMarketplace: 'https://www.satflow.com/ordinal/',
  ordNetMarketplace: 'https://ord.net/inscription/',
};
