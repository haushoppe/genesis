# Cubes-frontend regtest e2e suite

Real-user-flow proof that inscribing a cube via each supported wallet
produces an ord-indexed HTML inscription. Not "the button works" —
"user clicks Connect → wallet approves → user fills form → user clicks
Mint → wallet signs → txs broadcast → ord indexes the cube HTML byte-
for-byte".

## Status (2026-07-07)

Infrastructure copied from `ordpool-space/ordpool-sdk` e2e/. Adapted
container names to `cubes-e2e-*` for local-dev isolation. **Specs not
yet written.**

| Piece | State |
|---|---|
| `docker-compose.regtest.yml` (bitcoind + electrs + ord + ord-stock) | copied, renamed containers |
| `regtest-bootstrap.sh` (deterministic BIP-39 wallet, 101 blocks) | copied |
| `regtest-helpers.ts` (rpc / mineBlocks / postTx / getOrdInscription / SIGHASH_ALL) | copied |
| `playwright-bootstrap.sh` (fetches wallet .crx from private releases) | copied |
| `playwright.config.ts` (headed Chromium, xvfb-friendly, cubes-frontend as webServer) | new |
| `global-setup.ts` (Xverse seed hydration) | copied, paths adjusted |
| `wait-helpers.ts` + `approval-popup.ts` + `cat21wallet-sign-popup.ts` | copied |
| `onboard-okx.ts` + `onboard-phantom.ts` | copied |
| `onboard-leather.ts` / `onboard-unisat.ts` / `onboard-oyl.ts` / `onboard-alby.ts` | **TODO** (extract from SDK per-wallet specs) |
| `specs/xverse-cube-mint-roundtrip.spec.ts` | **TODO** — the reference spec |
| Other 7 wallet specs | **TODO** — templated from xverse |
| `honest-wallet-coverage.spec.ts` (audit gate) | **TODO** |
| `.github/workflows/e2e-cubes-regtest.yml` | **TODO** |
| Environment: `environment.regtest.ts` + angular.json `regtest` config | **TODO** — `mempoolApiUrl` must point at `http://localhost:3000` and the tip address must be a regtest bcrt1p... |

## The mint round-trip a spec must exercise

1. **beforeAll** — clone the Xverse seed user-data-dir, launch headed
   Chromium with the wallet .crx loaded, extract extension id from the
   service worker URL.
2. **Open cubes-frontend** at `http://localhost:4203/`.
3. **Fund** the wallet's regtest payment address via `bitcoin-cli
   sendtoaddress`. Mine 1 block. Wait for electrs to index.
4. **Click Connect [Xverse]** in the UI. Handle the wallet's approval
   popup (`waitForApprovalPopup`). Assert the on-page "Connected as
   bcrt1p…" appears.
5. **Fill the form**: 6 inscription IDs, fee rate. The dev server
   preview iframe renders the cube HTML that will be inscribed.
6. **Click Mint**. Handle the wallet's signing popup. Wait for the
   on-page success alert to render both txids.
7. **Broadcast + mine**: assert commit + reveal actually reached
   electrs (postTx idempotent), mine 1 block per tx, wait for
   confirmation.
8. **Ord assertion**: poll `ord.regtest/inscription/<revealTxid>i0` for
   indexing. Fetch `ord.regtest/content/<id>`. Assert content type is
   `text/html;charset=utf-8` and the bytes match the cube HTML the
   preview iframe built. Parse via `parseCube()` — round-trip has to
   produce the same 6 IDs.

## Commands

```bash
npm run test:e2e:regtest:up      # bring up bitcoind + electrs + ord
npm run test:e2e:regtest         # run the Playwright suite (needs :up first)
npm run test:e2e:regtest:down    # stop + wipe the stack
```

`playwright-bootstrap.sh <wallet>` downloads and unpacks the .crx into
`extensions/<wallet>/`. Requires `GH_TOKEN` (hans-crypto scope) since
the binaries live in private releases on
`ordpool-space/ordpool-sdk`.

## CI

`.github/workflows/e2e-cubes-regtest.yml` (TODO) mirrors
`ordpool-sdk`'s `e2e-playwright.yml`: ubuntu-latest + xvfb + docker
compose. Wallet .crx cached per version. Timeout ~45 min. Runs the
whole suite on every push to `main` + on PRs that touch
`apps/cubes-frontend/**`.

## What's next

Priority order for the follow-up work:

1. **Environment.regtest.ts + angular.json config** — swap
   `mempoolApiUrl` + tip address at build time so the spec's dev
   server hits the local stack.
2. **xverse-cube-mint-roundtrip.spec.ts** — the reference spec.
   Everything else templates off it.
3. **CI workflow** — get the empty scaffold running on GitHub Actions
   so failure surfaces are visible even before every wallet is
   covered.
4. **Fan out to the other 7 wallets**: Leather, Unisat, OKX, Phantom,
   Oyl, CAT-21 Wallet, xpub. Each needs its own onboarding module +
   spec.
5. **Audit gate** — a Jest / Playwright spec that verifies every entry
   in `KnownOrdinalWalletType` has a matching
   `<wallet>-cube-mint-roundtrip.spec.ts`.
