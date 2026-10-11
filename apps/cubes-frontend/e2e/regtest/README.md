# Cubes-frontend regtest e2e suite

Real-user-flow proof that inscribing a cube via each supported wallet
produces an ord-indexed HTML inscription. Not "the button works" —
"user clicks Connect → wallet approves → user fills form → user clicks
Mint → wallet signs → txs broadcast → ord indexes the cube HTML byte-
for-byte".

## Building blocks

The e2e infrastructure is sourced from `ordpool-space/ordpool-sdk`.
Specs import the shared wallet onboarders (`onboardXverse`,
`onboardUnisat`, `seedAlbyAccount`, …) and `approval-popup` helpers
(`waitForApprovalPopup`, `closeLeftoverExtensionPages`) from the
compiled `ordpool-sdk/e2e` subpath barrel: pre-built CommonJS that
Playwright loads without a transpile step. `global-setup.ts` pulls the
Xverse onboarder (`onboardXverse`, `primeAndSwitchToRegtest`,
`overrideRegtestElectrsUrl`) from the same barrel.

The chain, electrs and ord helpers (`rpc`, `mineBlocks`, `fundCommonSats`,
`waitForElectrsSync`, `getUtxos`, `getStockOrdContent`, …) and the
browser-error guard (`installContextErrorGuard`) come from the same barrel.

Kept local to this suite (genesis-specific, not sourced from the SDK):
`regtest-helpers.ts` (cubes-only helpers such as `openDetails` and
`fillCubeSides`, each marked app-specific), `global-setup.ts` (Xverse seed
hydration), `playwright.config.ts`, and the `*-bootstrap.sh` scripts.
`playwright-bootstrap.sh <wallet>` fetches the wallet `.crx` from private
`ordpool-sdk` releases (needs `GH_TOKEN`).

The regtest Docker stack (bitcoind + electrs + ord-stock) is the SDK's
shipped `docker-compose.regtest.yml`, loaded from
`node_modules/ordpool-sdk/e2e/` — no local copy. It is parametrized via
`E2E_PREFIX=cubes-e2e` (keeps the `cubes-e2e-*` container names this
suite's helpers expect) plus `ELECTRS_SRC` / `CAT21_ORD_SRC` (build
contexts). The `regtest-bootstrap.sh` script sets those defaults for a
standalone local run; CI sets them at the job level.

## Offline browsers and the net log

Every wallet browser starts through `launchWalletContext` (ordpool-sdk/e2e),
which resolves nothing but loopback and the regtest stack's hosts
(`reachableHosts`) and sends every other request to a dead proxy. The specs
without an extension start through `launchOfflineBrowser`, under the same
guarantees, the dead-proxy check included. A wallet vendor's backend is answered
or aborted by the SDK's shield for that wallet (`installXverseOfflineRoutes`,
`installLeatherOfflineRoutes`, `installCat21WalletOrdRoutes`, ...), installed
right after the launch. A Cat21 Wallet page is closed with
`closeCat21WalletPage`, which navigates it away first so its pending cat21-ord
reads are cancelled instead of reaching the network.

With `ORDPOOL_E2E_NET_LOG_DIR` set, every launch writes Chrome's net log into
that directory, and `node node_modules/ordpool-sdk/scripts/check-net-log.mjs
<dir>` fails on any connection, datagram or DNS lookup that left the machine.
CI runs it after the specs of every lane and uploads the logs.

## Build pins

ordpool-electrs, cat21-ord, Cat21 Wallet and the ordpool backend are built from
the full shas in `node_modules/ordpool-sdk/e2e/build-pins.env`, the copy that
matches `package-lock.json`. CI checks them out by sha; `regtest-bootstrap.sh`
compares `ELECTRS_SRC` / `CAT21_ORD_SRC` / `ORDPOOL_SRC` with the pins and fails
under CI on a mismatch.

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
npm run e2e:regtest:up      # bring up bitcoind + electrs + ord-stock, mine 101 blocks
npm run e2e:regtest         # run the Playwright suite (needs :up first)
npm run e2e:regtest:down    # stop + wipe the stack
```

`playwright-bootstrap.sh <wallet>` downloads and unpacks the .crx into
`extensions/<wallet>/`. Requires `GH_TOKEN` (hans-crypto scope) since
the binaries live in private releases on
`ordpool-space/ordpool-sdk`.

## CI

`.github/workflows/e2e-cubes-regtest.yml` mirrors `ordpool-sdk`'s
Playwright job: ubuntu-latest + xvfb + docker compose. Wallet .crx
cached per version. Timeout ~45 min. Runs the whole wallet matrix on
every push to `main` + on PRs that touch `apps/cubes-frontend/**`.

## Coverage

One `<wallet>-cube-mint-roundtrip.e2e.spec.ts` per supported wallet:
Xverse, Leather, Unisat, Wizz, OKX, CAT-21 Wallet, Alby. (Oyl was
removed 2026-08-06 after its vendor decommissioned the backend infra;
re-add if a successor ships.)
