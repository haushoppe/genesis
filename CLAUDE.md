# CLAUDE.md

Guidance for Claude Code in the `haushoppe/genesis` repo.

## What this repo is

**Ordinal Cubes by HAUS HOPPE**: a permissionless 3D cube gallery on Bitcoin Ordinals. A user picks 6 existing inscriptions, one per cube side, and mints a new HTML inscription that renders an interactive 3D cube.

| | |
|---|---|
| Live product | https://cubes.haushoppe.art/ (Cloudflare Pages) |
| Backend API | https://backend.haushoppe.art/ (happysrv via Cloudflare Tunnel, `ordpool/deploy-happyserver/haushoppe-backend.service`) |

| Path | What | State |
|---|---|---|
| `apps/cubes-frontend/` | Angular 22 SPA, zoneless, signal-first | LIVE product |
| `apps/backend/` | NestJS API, Node 18, no database | Live, ERC-721 side only |
| `apps/genesis-frontend/` | Angular 16 SPA, ERC-721 mint, Kendo UI + `@web3-onboard/*` | Inactive, never shipped |
| `contracts/` | Solidity ERC721A + Hardhat | |

`apps/cubes-frontend/CLAUDE.md` holds the frontend conventions and its own HARD RULEs. Read it before touching that app.

## RULE: Each project owns its dependencies

- No root `npm install`. Each `apps/*` has its own `package.json`, `tsconfig.json`, build, test and lint, and no root-level tooling is shared.
- The root `package.json` is a stub of shortcuts (`npm run start:backend`). No root devDeps, no root `node_modules`.
- Shared code is vendored per project into `src/shared/` and `src/openapi-client/`. Drift between copies is accepted; the surface is tiny.

## RULE: native `fetch` only, never `axios`

- Applies to `apps/backend` and every frontend. `HttpClient` is fine in Angular where DI integration is wanted.
- Why: supply-chain exposure. Matches the workspace-wide ban.

## RULE: cubes-frontend does not call the backend

- It mints through `ordpool-sdk` (commit + reveal, signed by the connected wallet, broadcast directly). No invoice, no server-side order, no intermediary.
- Its datasets (cube suggestions, collection lists) come from static GitHub Pages sources, or on regtest from environment-supplied surrogates.
- `apps/backend` serves the ERC-721 side only, for the inactive genesis-frontend.

## Commands

```bash
# Install, per project
cd apps/backend          && npm ci
cd apps/cubes-frontend   && npm ci
cd apps/genesis-frontend && npm ci

# Develop, each in its own terminal
cd apps/backend          && npm start   # NestJS, PORT env var; 3344 in production
cd apps/cubes-frontend   && npm start   # ng serve on :4203
cd apps/genesis-frontend && npm start   # ng serve on :4201

# Build and test
npm run build            # per project
npm test                 # per project

# Contracts
cd contracts && npm install
cd contracts && npm run hardhat:start-localhost-network
cd contracts && npm run hardhat:test
```

## apps/backend

- No database. State is in-memory or fetched from external APIs.
- Routes: `GET /` and `GET /robots.txt` (`AppController`); `POST /api/mintTicket` plus the `GET /api/...` token routes (`ApiController`) for mint tickets, token metadata, owners, allowlist and token images.
- Ethereum on-chain reads go through Alchemy. Cubes minting needs no server-side API.
- OpenAPI at `/open-api` (UI) and `/open-api-json` (spec).
- Build output: `dist/main.js` (webpack-bundled) + `dist/assets/` + the project's own `package.json`, shipped as-is to `haushoppe/backend-build@stage_prod`.

## apps/cubes-frontend

- Angular 22 standalone components, zoneless, signal-first. No NgModules, no NgRx.
- State: `signal()` / `computed()` / `linkedSignal()`, `rxResourceFixed()` for async data, localStorage-backed signals (`cube_` prefix) for mint history. Wallet connection via `ordpool-sdk`'s `WalletService`, any ordinals-aware wallet.
- Routes (`ordinal.routes.ts`): `/` mint form + past mints; `/mint/:collectionSymbol` pre-selected collection; `/inscription/:inscriptionId`; `/faq`; `/presskit`.
- Mint flow: connect wallet, enter six inscription ids, the wallet signs a commit then a reveal carrying the cube HTML, and the cube lands on the wallet's ordinals address. Built on `InscribeMintOrchestrator`. Both transactions carry `nLockTime=21`, so each mint also inscribes two CAT-21 cats.
- Cube HTML: `<html><!--cubes.haushoppe.art--><head><title>TITLE</title></head><body><script>t='id1|...|id6|...'</script><script src=/content/CUBE_RENDERER_INSCRIPTION></script>`
- Three renderer versions (v1, v2, v3), identified by inscription id in `src/shared/ordinals/parse-cube.ts`.
- Validators: `inscription-id.validator.ts` (64 hex + `i` + digits), `btc-address.validator.ts` (Taproot `bc1p...`), `correct-code.validator.ts` (referral codes ending `_N`).
- Inscription lookup by number (the user types `#12345`): `mintService.inscriptionNumberToId()` calls `https://ord.ordpool.space/inscription/{n}` with `Accept: application/json`.

<!-- long-rule: two measured traps whose numbers and failed approaches are the load-bearing part -->
## RULE: Two cubes-frontend behaviours are measured, do not re-derive them

- **Cube iframes**: every on-chain cube renders through `ToggleIframeDirective` + `src/app/shared/utils/cube-srcdoc.ts`. Bytes are fetched and shown as `srcdoc`, with an in-document dark `color-scheme` meta, the renderer's stage reproduced as CSS, a dark placeholder off-screen, and every document after the first in a FRESH iframe element. Chrome does not paint a re-navigated iframe whose previous document ran WebGL.
- **`deployUrl: "/"`** in `angular.json` makes every resource URL in `index.html` root-absolute. Cloudflare Pages turns the `modulepreload` hint into an HTTP `Link` header, and a relative target resolves against the request URL, so a nested route preloads a path the SPA fallback answers with HTML.
- Both carry their proof, their failed alternatives and the measurement a replacement must pass in `apps/cubes-frontend/CLAUDE.md`. Read that before changing either.

Why: both shipped as regressions once, green, and were fixed only after measurement.

## apps/genesis-frontend

- Angular 16, ERC-721 mint flow, Kendo UI, `@web3-onboard/*`.
- `webpack.config.js` supplies Node-builtin polyfills (`buffer`, `crypto-browserify`, `stream-*`) the web3 libraries need; `angular.json` uses `@angular-builders/custom-webpack:browser` for it.

## CI/CD

| Workflow | Trigger | Does |
|---|---|---|
| `build-backend.yml` | push to `apps/backend/**` | `npm ci && npm test && npm run build`, pushes `dist/` + `package.json` + `package-lock.json` to `haushoppe/backend-build@stage_prod`. happysrv's `haushoppe-backend-deploy.timer` polls that branch every minute, runs `npm ci --omit=dev`, restarts `haushoppe-backend.service`. Under 60s from CI to live. |
| `build-cubes-frontend.yml` | push to `apps/cubes-frontend/**` | `npm ci && npm test && npm run build`, pushes `dist/` to `haushoppe/cubes-frontend-build@main`; Cloudflare Pages auto-deploys to cubes.haushoppe.art. |
| `build-genesis-frontend.yml` | push to `apps/genesis-frontend/**` | Same shape. Runs `npx kendo-ui-license activate` first. Pushes to `haushoppe/genesis-frontend-build@main`. |

Workflows run Node 18 with `npm ci`.

## Environment (apps/backend)

Template: `ordpool/deploy-happyserver/haushoppe-backend.env.example`.

- `NODE_ENV=production`
- `PORT=3344` in production
- `NETWORK`: `hardhat`, `goerli` or `mainnet`
- `SIGNER_KEY_*`: six private keys for ERC-721 mint-ticket signing
- `ALCHEMY_KEY_MAINNET`, `ALCHEMY_KEY_GOERLI`

## Code style

- Prettier with `"singleQuote": true`. EditorConfig: 2-space indent, LF, UTF-8.
- ESLint per project (`apps/*/.eslintrc.json`), `eslint:recommended` + `@typescript-eslint/recommended`.
- Angular: standalone components, SCSS. cubes-frontend is signal-first with no NgRx; only the inactive genesis-frontend uses NgRx (`createFeature()` + facades).
