# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nx 16 monorepo for the **Ordinal Cubes by HAUS HOPPE** project — a permissionless 3D cube gallery on Bitcoin Ordinals. Users select 6 existing inscriptions (one per cube side) and mint a new HTML inscription on Bitcoin that renders an interactive 3D cube.

**Live product:** https://cubes.haushoppe.art/ (Cloudflare Pages)
**Backend API:** https://backend.haushoppe.art/ (Koyeb)

The genesis-frontend (Ethereum ERC-721 minting) was never finished and is inactive. The cubes-frontend is the live, active product.

## Commands

```bash
# Install
npm install

# Development — start backend + cubes frontend
npm run start:backend          # NestJS on port 3333
npm run start:cubes-frontend   # Angular on port 4203, proxies /content/* to ordinals explorers

# Start everything (backend + both frontends)
npm start

# Build
npm run build:backend:production
npm run build:cubes-frontend:production

# Test (Jest via Nx)
npm run test                   # All projects
npm run test:backend
npm run test:cubes-frontend

# Regenerate OpenAPI client (backend must be running on :3333 first)
npm run build:openapi-generator

# Smart contracts (Hardhat, in contracts/ directory)
cd contracts && npm run hardhat:start-localhost-network
cd contracts && npm run hardhat:test
```

## Architecture

### Monorepo Layout

```
apps/
  cubes-frontend/     # Angular 16 SPA — the LIVE product (Bitcoin Ordinals cube minting)
  backend/            # NestJS API — serves both frontends
  genesis-frontend/   # Angular 16 SPA — INACTIVE (Ethereum ERC-721 minting, never finished)
  shared/             # Shared TypeScript code (not a runnable app)
libs/
  openapi-client/     # Auto-generated Angular HTTP client — DO NOT EDIT manually
contracts/            # Solidity ERC721A smart contracts + Hardhat setup
tools/
  generators/openapi-generator/   # Generates libs/openapi-client from backend OpenAPI spec
```

### Cubes Frontend (the live product)

Angular 16 standalone components app. No NgModules — uses `provideRouter()`, `provideStore()`, etc.

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

Three cube renderer versions exist (v1, v2, v3) identified by their inscription IDs in `parse-cube.ts`.

**Form validators:** `inscription-id.validator.ts` (64 hex + `i` + digits), `btc-address.validator.ts` (Taproot `bc1p...` required), `correct-code.validator.ts` (referral codes ending in `_N`).

### Backend (NestJS)

**No database** — everything is in-memory or fetched from external APIs.

**Ordinals endpoints** (the active part, `OrdinalsController`):
- `POST /ordinals/createHtmlInscriptionOrder` — creates inscription via OrdinalsBot API
- `GET /ordinals/getOrderStatus/:id` — polls OrdinalsBot for payment status
- `GET /ordinals/getInscriptions/:collectionName/:itemsPerPage/:currentPage` — paginated cube list
- `GET /ordinals/getSingleInscription/:collectionName/:inscriptionId` — single inscription with prev/next
- `GET /ordinals/getPrice/:fee/:size/:code?` — pricing in sats + USD
- `GET /ordinals/getCubeSuggestion/:collectionSymbol?` — 6 random unclaimed image inscriptions from Magic Eden

**CubeService:** Runs every 5 minutes (`@Interval`), searches OrdinalsBot for inscriptions containing `cubes.haushoppe.art`, parses them with `parseCube()`, stores in-memory array. Only updates if new count > old count.

**CubeSuggestionService:** Picks random collections from Magic Eden (top 250 by 7-day volume), finds unclaimed image inscriptions not already used in existing cubes. Only accepts image MIME types (no SVG — "too much black cubes").

**External APIs:** OrdinalsBot (inscription orders, search, pricing, FX rates), Magic Eden (collections, tokens), Hiro (inscription lookup by number), ordinals.com/explorer.ordinalsbot.com (scraping inscription metadata via cheerio).

**Caching:** NodeCache with TTLs — 60s for inscription data (HTTP `Cache-Control` headers), 2h for hosted file content, in-memory for cube list (refreshed every 5min). Suggestions use `no-cache`.

**Swagger/OpenAPI:** Available at `/open-api` (UI) and `/open-api-json` (spec).

### Shared Code (`apps/shared/`)

- `ordinals/parse-cube.ts` — validates cube HTML, extracts 6 sides + version + title as trait attributes
- `ordinals/hiro.ts` — Hiro API client for inscription lookup
- `ordinals/ord.ts` — scrapes ordinalsbot explorer for inscription metadata (cheerio)
- `ordinals/referral-code.ts` — referral codes with bonus amounts and Bitcoin addresses
- `ordinals/ordinalsbot-*.ts` — TypeScript types for OrdinalsBot API responses
- `known-abis.ts`, `known-token-name.ts`, `known-network-name.ts` — ERC-721 contract definitions

### OpenAPI Client (`libs/openapi-client/`)

Auto-generated from backend spec. Two services: `ApiService` (ERC-721 endpoints) and `OrdinalsService` (Bitcoin endpoints). Regenerate by running the backend then `npm run build:openapi-generator`.

## CI/CD & Deployment

GitHub Actions (`.github/workflows/`):
- **build-cubes-frontend.yml** — triggered on push to main affecting `apps/cubes-frontend/**` or `libs/**`. Runs tests, production build, publishes to `haushoppe/cubes-frontend-build` repo → Cloudflare Pages auto-deploys.
- **build-backend.yml** — triggered on push to main affecting `apps/backend/**`. Runs tests, production build, publishes to `haushoppe/backend-build` repo → Koyeb auto-deploys.
- **redeploy-backend.yml** — manual workflow dispatch to redeploy Koyeb service via API.
- **build-genesis-frontend.yml** — publishes to `haushoppe/genesis-frontend-build` (inactive product).

Workflows use Node 18 and `npm install --force`.

## Environment

Copy `.env.example` to `.env`. Key variables:
- `NETWORK` — `hardhat`, `goerli`, or `mainnet`
- `SIGNER_KEY_*` — private keys for ERC-721 mint ticket signing (6 token types)
- `MAGIC_EDEN_API_KEY` — for collection browsing and cube suggestions
- `ORDINALSBOT_API_KEY` — for inscription creation, search, pricing

## Code Style

- Prettier: single quotes (`"singleQuote": true`)
- EditorConfig: 2-space indent, LF line endings, UTF-8
- ESLint with `@nx/enforce-module-boundaries`
- Angular: standalone components, SCSS styles
- NgRx: `createFeature()` pattern with facade services
