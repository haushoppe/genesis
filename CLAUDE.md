# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Repo for the **Ordinal Cubes by HAUS HOPPE** project — a permissionless 3D cube gallery on Bitcoin Ordinals. Users select 6 existing inscriptions (one per cube side) and mint a new HTML inscription on Bitcoin that renders an interactive 3D cube.

**Live product:** https://cubes.haushoppe.art/ (Cloudflare Pages)
**Backend API:** https://backend.haushoppe.art/ (happysrv via Cloudflare Tunnel — see `ordpool/deploy-happyserver/haushoppe-backend.service`)

The genesis-frontend (Ethereum ERC-721 minting) was never finished and is inactive. The cubes-frontend is the live, active product.

## Layout

Three independent projects + contracts. **No root `npm install`** — each project owns its deps.

```
apps/
  backend/            # NestJS API (Node 18). Standalone Nest CLI project.
  cubes-frontend/     # Angular 16 SPA (the LIVE product). Standalone Angular CLI project.
  genesis-frontend/   # Angular 16 SPA (INACTIVE, ERC-721 minting). Standalone Angular CLI project.
contracts/            # Solidity ERC721A smart contracts + Hardhat setup.
```

Each `apps/*` has its own `package.json`, `tsconfig.json`, build, test, and lint. They share **no** root-level tooling. Shared code (`apps/shared/`, the old `libs/openapi-client/`) used to live at the root — it's now **vendored into each project's `src/shared/` and `src/openapi-client/`**. Drift between copies is acceptable; the surface area is tiny and rarely changes.

## Commands

```bash
# Install (per project, on first checkout or after a deps change)
cd apps/backend         && npm ci
cd apps/cubes-frontend  && npm ci
cd apps/genesis-frontend && npm ci

# Development (each in its own terminal)
cd apps/backend          && npm start       # NestJS on the PORT env var (production: 3344 on happysrv)
cd apps/cubes-frontend   && npm start       # ng serve on :4203
cd apps/genesis-frontend && npm start       # ng serve on :4201

# Build (per project — CI does this on push)
cd apps/backend         && npm run build    # nest build --webpack → dist/main.js
cd apps/cubes-frontend  && npm run build    # ng build production → dist/*
cd apps/genesis-frontend && npm run build   # ng build production → dist/*

# Test
cd apps/backend         && npm test         # jest (4 suites, 17 tests)
cd apps/cubes-frontend  && npm test         # jest + jest-preset-angular (6 suites, 25 tests)
cd apps/genesis-frontend && npm test        # jest + jest-preset-angular (1 suite, 4 tests)

# Smart contracts (Hardhat)
cd contracts && npm install
cd contracts && npm run hardhat:start-localhost-network
cd contracts && npm run hardhat:test
```

The root `package.json` is intentionally a tiny stub with just convenience shortcuts (`npm run start:backend` → `cd apps/backend && npm start`). There are no root devDeps and no root `node_modules`.

## apps/backend (NestJS)

**No database** — everything is in-memory or fetched from external APIs.

**Live endpoints:**
- `POST /ordinals/createHtmlInscriptionOrder` — creates inscription via OrdinalsBot API
- `GET /ordinals/getOrderStatus/:id` — polls OrdinalsBot for payment status
- `GET /ordinals/getPrice/:fee/:size/:code?` — pricing in sats + USD (validates referral code for bonus)
- `GET /api/...` (12 routes on `ApiController`) — ERC-721 metadata for genesis-frontend (mint tickets, owners, allowlist, token images)

**External APIs:** OrdinalsBot (orders, pricing), api.ordpool.space (BTC/USD fxrate replacement for OrdinalsBot's broken /fxrate, mempool fees). Old Hiro/Magic Eden/cube-suggestion/cube-list integrations are gone — cubes-frontend reads those datasets directly from static GitHub Pages sources now.

**HTTP client:** native `fetch` only. **axios is forbidden** (supply-chain risk).

**Caching:** NodeCache with TTLs — 2h for hosted file content fetched during order polling, 60s for price cache.

**Swagger/OpenAPI:** Available at `/open-api` (UI) and `/open-api-json` (spec).

**Build output:** `apps/backend/dist/main.js` (webpack-bundled) + `apps/backend/dist/assets/` + the project's own `package.json` (15 deps). CI ships this as-is to `haushoppe/backend-build@stage_prod`. No more "trim monorepo deps" build step.

## apps/cubes-frontend (the live product)

Angular 16 standalone-components app. No NgModules — uses `provideRouter()`, `provideStore()`, etc.

**State management:** NgRx with three feature stores:
- `mint` — inscription list, order state, pricing, cube suggestions, inscription ID cache
- `wallet` — connected Bitcoin wallet (Xverse via Sats-Connect)
- `past` — order/inscription history, synced to localStorage with `cube_` prefix

**Key routes** (`ordinal.routes.ts`):
- `/` — StartComponent with mint form + past orders
- `/mint/:collectionSymbol` — StartComponent with pre-selected collection for suggestions
- `/inscription/:inscriptionId` — Single inscription detail
- `/order/:orderId` — Traditional order tracking (OrdinalsBot payment QR codes)
- `/order-connect/:txId` — Xverse/Sats-Connect order tracking (mempool polling)
- `/faq`, `/presskit`

**Effects use route-driven patterns** — `ofRoute()` operator triggers data loading based on navigation. Polling (every 3.5s) runs on order pages until payment/confirmation detected.

**Two minting flows:**
1. **Traditional (OrdinalsBot):** User enters receive address → backend creates order → user pays via on-chain BTC or Lightning → polling until `file.sent` is set
2. **Xverse/Sats-Connect:** Wallet signs PSBT directly → polls mempool.space for confirmation

**Cube HTML format:** `<html><!--cubes.haushoppe.art--><head><title>TITLE</title></head><body><script>t='id1|id2|id3|id4|id5|id6|...'</script><script src=/content/CUBE_RENDERER_INSCRIPTION></script>`

Three cube renderer versions exist (v1, v2, v3) identified by their inscription IDs in `src/shared/ordinals/parse-cube.ts`.

**Form validators:** `inscription-id.validator.ts` (64 hex + `i` + digits), `btc-address.validator.ts` (Taproot `bc1p...` required), `correct-code.validator.ts` (referral codes ending in `_N`).

**Inscription lookup by number** (when the user types `#12345`): `mintService.inscriptionNumberToId()` hits `https://ord.ordpool.space/inscription/{n}` with `Accept: application/json`. Hiro API was sunsetted; the ord-proxy in the ordpool family fills the same role.

**HTTP client:** native `fetch` and Angular `HttpClient`. **axios is forbidden.**

## apps/genesis-frontend (inactive)

Angular 16 app for ERC-721 mint flow. Uses Kendo UI components and `@web3-onboard/*` for wallet connection. Custom webpack config (`webpack.config.js`) provides Node-builtin polyfills (`buffer`, `crypto-browserify`, `stream-*`, etc) required by the web3 libs — `angular.json` uses `@angular-builders/custom-webpack:browser` for this.

## CI/CD & Deployment

`.github/workflows/`:

| Workflow | Trigger | What it does |
|---|---|---|
| `build-backend.yml` | push to `apps/backend/**` | `cd apps/backend && npm ci && npm test && npm run build`. Pushes `dist/` + `package.json` + `package-lock.json` to `haushoppe/backend-build@stage_prod`. happysrv's `haushoppe-backend-deploy.timer` polls that branch every minute, runs `npm ci --omit=dev`, restarts `haushoppe-backend.service`. ≤60s lag CI → live. |
| `build-cubes-frontend.yml` | push to `apps/cubes-frontend/**` | `cd apps/cubes-frontend && npm ci && npm test && npm run build`. Pushes `dist/` to `haushoppe/cubes-frontend-build@main` → Cloudflare Pages auto-deploys to cubes.haushoppe.art. |
| `build-genesis-frontend.yml` | push to `apps/genesis-frontend/**` | Same shape. Activates Kendo UI license via `npx kendo-ui-license activate`. Pushes to `haushoppe/genesis-frontend-build@main`. |

Workflows use Node 18 + `npm ci`. The `npm install --force` workaround days are gone — each project has its own clean lockfile.

## Environment (apps/backend)

See `ordpool/deploy-happyserver/haushoppe-backend.env.example`. Required vars:
- `NODE_ENV=production`
- `PORT=3344` (server-side; dev defaults to whatever you set)
- `NETWORK` — `hardhat`, `goerli`, or `mainnet`
- `SIGNER_KEY_*` — six private keys for ERC-721 mint ticket signing
- `ALCHEMY_KEY_MAINNET`, `ALCHEMY_KEY_GOERLI`

## Code Style

- Prettier: single quotes (`"singleQuote": true`)
- EditorConfig: 2-space indent, LF line endings, UTF-8
- ESLint: per-project standalone configs (`apps/*/.eslintrc.json`) using `eslint:recommended` + `@typescript-eslint/recommended`. No `@nx/enforce-module-boundaries` anymore.
- Angular: standalone components, SCSS styles
- NgRx: `createFeature()` pattern with facade services
