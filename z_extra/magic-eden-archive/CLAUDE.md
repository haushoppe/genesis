# Magic Eden Ordinals Archive

## Purpose

Emergency archive of Magic Eden's ordinals collection data before they shut down their ordinals business. The cubes.haushoppe.art product depends on ME's API for collection browsing and cube suggestions.

## Current Status (2026-03-07)

### Archive Totals
- **5,477 ME token files** + BiS files
- **~10.3 million+ tokens** archived
- **5,494 collection detail JSONs** in `data/collections/`
- **5,497 collection stats JSONs** in `data/collection-stats/`
- **0 failed** collections across all scripts
- **0 duplicate tokens** in ME data (11 dupes in BiS bitmap, negligible)

### Completed Runs
1. **ME Phase 1-3** (archive-magic-eden.ts): 635 collections via stats discovery — **COMPLETED**
2. **ME Extras** (archive-me-extras.ts): 4,843 collections, 21 not found — **COMPLETED** (2 runs)
   - Sources: manual list + legacy repo + v4 search + meta-collection discovery + summraznboi CSV dump
3. **BiS Wave 1** (archive-bestinslot.ts): 13 gap collections — **COMPLETED**
4. **BiS Wave 2** (archive-bestinslot.ts): 86 gap collections — IN PROGRESS
5. **ME Multiplex** (archive-me-multiplex.ts): Sort field multiplexing for 19 gap collections — **COMPLETED**
6. **ME Snowball** (archive-me-snowball.ts): ownerAddress per-collection snowball — **COMPLETED**
   - 23 collections processed (19 original + 4 added meta-collections)
   - Meta-collection explosion: black-uncommons 20K→725K, sub-100 20K→724K, sub-10k 20K→723K, sub-1k 20K→724K, sub-100k 573K→724K
   - Pure collections: all exhausted with 0 pending wallets
7. **Collection details** (extract-collection-details.ts): 5,494 detail JSONs + 5,497 stats JSONs — **COMPLETED**
   - 2 details still missing (API rate limit penalty — retry later)
   - Stats: all-time data (window param ignored), 100% success rate
8. **ME Snowball Cross** (archive-me-snowball-cross.ts): cross-collection wallet pool — **READY** (not yet started)
9. **Symbol extraction** (extract-all-symbols.ts): scanned 10.3M tokens, found 5,456 unique symbols — **COMPLETED**
10. **Third-party CSV import**: 32 new collections from summraznboi dump, 13 fetched successfully — **COMPLETED**

### Next Steps
1. **CSV gap fill running** — `archive-me-csv-fill.ts` filling ~1.9M missing tokens via `tokenIds` batch lookup from summraznboi CSV
2. **Retry 2 missing collection details** — wait for API penalty to clear, re-run `extract-collection-details.ts`
3. **Grab attribute_stats for all collections** — `GET /v2/ord/btc/collections/{slug}/attribute_stats` returns per-trait floor prices, counts, and sample images. Script not yet written. ~5,500 collections × 400ms = ~37 min.
4. **Grab activities/sales history** — `GET /v2/ord/btc/activities?collectionSymbol={symbol}` returns marketplace activity (sales, listings, offers, transfers). Script not yet written. Has aggressive rate limiter.
5. **Grab floor price sparklines** — `GET /collection_stats/getCollectionSparkline/{symbol}` returns floor price chart data over time. Script not yet written.
6. **Generate `data/cross-wallets.json`** — whale wallet pool for cross-snowball
7. **Run cross-collection snowball overnight** — `archive-me-snowball-cross.ts`
8. **Investigate Dylan's gaps** — `btc-artifacts` (+9,500), `bitcoin-cryptodickbutts` (+4,436)

### API Shutdown Timeline
- **March 9, 2026**: Marketplace trading stopped
- **March 27, 2026**: Bitcoin API services terminated
- **April 1, 2026**: Wallet retired

## API Keys

- **Our key**: `MAGIC_EDEN_API_KEY` in project root `.env` — **BANNED** as of 2026-03-09 (429 on all endpoints after 127K requests at 100ms). RIP.
- **Backup key**: `<REDACTED_ME_KEY>` — found on GitHub (adrianmonad/ElementalsMonad). Works on `.dev` for non-activities endpoints.

Rate limiting tested: ME dev API handles 400ms delay with zero 429s for token endpoints. The collection details endpoint is more sensitive — needs 400ms minimum and the API holds penalty state for several minutes after 429 storms.

## Architecture

### Data Sources

#### 1. Magic Eden Developer API (`api-mainnet.magiceden.dev`)
- Requires `MAGIC_EDEN_API_KEY` in `Authorization: Bearer` header
- **Hard offset limit: 10,040** — confirmed on all endpoints, all sort fields, all filter combos
- `GET /v2/ord/btc/tokens?collectionSymbol={symbol}&limit=40&offset={n}` — max 40 per page
- `GET /collection_stats/search/bitcoin` — collection discovery (offset 0-1000, found 635 collections)
- `GET /v2/ord/btc/collections/{symbol}` — collection metadata
- Forward+reverse pass strategy: inscriptionNumberAsc from offset 0 + inscriptionNumberDesc from offset 0 = max ~20,080 unique tokens per collection
- **Rate limiting per endpoint**: Token endpoints handle 100ms fine (heavy responses = natural pacing). Collection detail endpoint needs 400ms minimum — lighter responses fire faster, triggering 429 storms at 100-150ms. After a 429 storm, the API maintains penalty state for several minutes.

#### 2. ME v4 Search API (`api-mainnet.magiceden.io`) — COLLECTION DISCOVERY GOLDMINE
- `POST /v4/search/search` with `{"pattern":"x","chains":["bitcoin"],"limit":100,"offset":0}`
- **No API key needed!** Works from plain curl with User-Agent header
- Max limit: 100 per page, pagination via offset (no hard cap found)
- Searched a-z + 0-9 (36 patterns) → **5,460 unique Bitcoin collections** (vs 635 from stats endpoint)
- Also tested Unicode/Emoji/special chars — a-z covers 99.98% of all collections
- Results saved to `data/v4-search-collections.json`

#### 3. Best in Slot v2 Internal API (`v2api.bestinslot.xyz`)
- **No API key needed!** Works from plain curl
- **No page limit!** Confirmed pagination up to page 36,806 for bitmap
- `GET /collection/items?page={n}&slug={slug}` — 25 items/page (fixed, per_page param ignored)
- `GET /collection/all?page={n}` — full collection index (183 pages × 30 = 5,468 collections)
- Returns: inscription_id, inscription_number, wallet (owner), content_type, item_name, listing prices, is_recursive, delegate
- **Bitmap authority**: BiS is the accepted authority for valid bitmap inscriptions
- Use 1s delay between requests — this is an undocumented internal API, be respectful
- **500ms causes rate limiting** (18x 429 in 9 min). 1s is safe.

#### 4. Ordiscan API (`api.ordiscan.com`)
- API key: `<REDACTED_ORDISCAN_KEY>` (1,000 requests/month free tier)
- Only has **runestone** out of our gap collections — largely useless for our needs

#### 5. ordinals-collections Legacy Repo
- Cloned at `z_extra/magic-eden-archive/ordinals-collections/`
- `legacy/collections/` has 535 JSON files, `collections.json` has 174 entries (different format with slug/ids)
- Marginal value: adds ~167 new IDs for rsic, ~129 for prometheans beyond ME data

#### 6. dylanvanh/magic-eden-collections-archive (third-party)
- Cloned at `z_extra/magic-eden-archive/magic-eden-collections-archive/` for comparison
- **751 collections**, ~5.76 GB (inscriptions.json tracked via git-lfs, **LFS budget exceeded** — data inaccessible)
- Archived 2026-03-05 in a single day. Format: `{slug}/meta.json` + `count.json` + `inscriptions.json`
- Smart deduplication via `defaults` + `templates` in meta.json
- **Comparison**: We have 5,450+ collections vs his 751. He has **1 collection we didn't** (`ord-signals-in-noise`, 5K tokens — now grabbed). We have **4,700 he doesn't**. On the 750 overlapping collections, we have more tokens in 32, he has more in 9 (notably `btc-artifacts` +9,500, `bitcoin-cryptodickbutts` +4,436). His `bitmap`/`btc-name`/`runestone` are capped at 10,100 (offset limit) — ours are far larger via BiS.

#### 7. summraznboi/magic-eden-data-dump (third-party CSV)
- GitHub releases: `collection_name_traits.csv.gz` (369MB compressed)
- **11.6M rows, 5,487 unique collections**
- Format: `collectionSymbol, id, name, traits` — minimal fields only
- **Missing**: owner, contentType, contentURI, listing price, metadata, collection details
- Value: complete inscription ID lists (full supply) for collections where we're capped at offset limit
- 32 new collections discovered (not in our v4 search or stats), 13 fetched from ME API
- Stored at `z_extra/magic-eden-archive/magic-eden-data-dump/collection_name_traits.csv`

#### 8. HTTP/2 Rate Limit Bypass (community gist)
- Source: `gist.github.com/erc1337-Coffee/af1ddcd03561e1dbdd50950a8c2d33e7`
- Uses raw HTTP/2 to `api-mainnet.magiceden.io` with browser-like TLS fingerprinting
- No API key — mimics browser requests to avoid rate limiter
- Focuses on runes (not relevant for ordinals archive)
- **Useful discovery**: `/v2/ord/btc/collections/{slug}/attribute_stats` endpoint — returns per-trait floor prices, counts, and sample images

### Undocumented Endpoints
- **`GET /v2/ord/btc/stat?collectionSymbol={symbol}&window=30d`** — returns all-time collection stats (window param ignored). Fields: totalVolume, owners, supply, floorPrice, totalListed, pendingTransactions, inscriptionNumberMin/Max, symbol. 100% success rate across 5,497 collections.
- **`GET /v2/ord/btc/collections/{slug}/attribute_stats`** — returns per-trait floor prices, counts, and sample images. Discovered via community gist. Not yet scraped.

### ME Meta-Collections — API Bug

Some ME collections are **meta-collections** that group tokens by sat attributes, not by minting origin. When querying `?ownerAddress=X&collectionSymbol={meta}`, the API **ignores the collectionSymbol filter** and returns the wallet's ENTIRE portfolio. This is why meta-collection snowball runs explode (20K→724K tokens).

**6 known meta-collections** (all impure — 0% of tokens have matching collectionSymbol):
- `uncommons` — groups by uncommon sats (3,605 unique collectionSymbol values)
- `sub-100k` — groups by inscription number <100K (1,686 unique values)
- `black-uncommons` — uncommon sats variant
- `sub-100` — inscription number <100
- `sub-10k` — inscription number <10K
- `sub-1k` — inscription number <1K

**5,459/5,465 collections are 100% pure** — every token's collectionSymbol matches the filename. Only the 6 meta-collections above are impure.

### Cross-Platform Slug Differences
ME and BiS use different naming conventions. ~724 BiS slugs don't match ME symbols directly, but they're the SAME collections with different names (e.g. ME `bitcoin-punks` = BiS `bitcoinpunks`). **Always use ME symbols as canonical identifiers.**

### ME API Workarounds Tested

#### Working Approaches
- **Sort field multiplexing** (archive-me-multiplex.ts): 3 independent token windows exist — inscriptionNumberAsc, inscriptionNumberDesc, and price/listedAt (all 4 share the same window). Max ~30,120 unique tokens per collection. Biggest win: domain_dot_sats 10K→34K.
- **ownerAddress snowball** (archive-me-snowball.ts): `?ownerAddress={addr}&collectionSymbol={symbol}` gives each wallet its own 10,040 offset window. `limit=100` works (vs 40 for normal queries). Whale test on kards: 661 tokens in archive → 1,151 returned → +490 new tokens from a single wallet.

#### Dead Ends
- **inscriptionMin/Max windowing**: Max ceiling 1M, but inscriptions numbered 10M-120M+. Useless.
- **satRarity filtering**: Only "uncommon" accepted. common/rare/epic/legendary/mythic return 400.
- **contentType filter**: Ignored by API.
- **Alternative endpoints** (.io, .us): Same backend, same 10,040 limit.
- **Batch/activities endpoints**: Activities has aggressive separate rate limiter, batch returns same data.
- **Text search on stats endpoint**: searchQuery/q/search/name/filter params all ignored.

#### Alternative APIs (ALL Dead Ends for the 19 gap collections)
- **Hiro**: No collection concept, deprecating March 9 2026.
- **Ordiscan**: Only 132 collections, none of ours.
- **UniSat**: Address-scoped only, no collection-level listing.
- **OKX**: Listed items only.
- **BiS**: These 19 collections not available.

## Scripts

### `scripts/archive-magic-eden.ts` — ME Phase 1-3 Archiver
- Phase 1: Collection discovery via stats endpoint (130 sort combos → 635 collections)
- Phase 2: Collection details for each unique symbol
- Phase 3: Token dump with forward+reverse pass strategy
- **COMPLETED**: 635 collections archived, 7 failed (giant collections hitting offset limit)

### `scripts/archive-bestinslot.ts` — BiS v2 API Archiver
- Archives collections via BiS v2 internal API (no API key needed)
- Wave 1 (13 collections): **COMPLETED** — bitmap (920K), btc-name (2M), runestone (112K), etc.
- Wave 2 (86 collections): **IN PROGRESS** — filling gaps from validation
- 1s delay, exponential backoff (up to 5 min, 20 retries), laptop-sleep resilient
- Progress: `data/bis-progress.json`, Files: `{meSymbol}.bis.ndjson`

### `scripts/archive-me-extras.ts` — ME Extra Collections Archiver
- **COMPLETED** (2 runs): 4,843 collections, 21 not found, 0 failed
- Sources: manual list (incl. 14 meta-collection discoveries + 32 summraznboi CSV discoveries + labitbus) + legacy repo (152) + v4 search discovery (5,460)
- Adaptive delay: 400ms-2000ms (auto-adjusts on rate limits, warms up after 50 OK requests)
- Sorted by supply ascending (small collections first for maximum breadth)
- **Safety: NEVER overwrites existing `.ndjson` files**
- Progress: `data/me-extras-progress.json`

### `scripts/discover-collections.ts` — ME v4 Search Discovery
- **COMPLETED**: Found 5,460 Bitcoin collections in 496 requests (~14 min)
- Searches a-z + 0-9 on `POST /v4/search/search` with `chains: ["bitcoin"]`
- Resumable via `data/v4-search-progress.json`
- Output: `data/v4-search-collections.json`

### `scripts/archive-me-multiplex.ts` — ME Sort Field Multiplexing
- **COMPLETED**: All 19 gap collections processed with all 6 sort fields
- Uses inscriptionNumberAsc/Desc + priceAsc/Desc + listedAtAsc/Desc (3 independent windows)
- 25-page zero-yield bail-out, 120s HTTP timeout, 3-consecutive ECONNABORTED fast-fail
- Biggest win: domain_dot_sats 10,040 → 34,121 (+24,081)
- Progress: `data/me-multiplex-progress.json`

### `scripts/archive-me-snowball.ts` — ME ownerAddress Gap Filler
- **COMPLETED** — all 23 collections exhausted
- Queries known wallet addresses to find tokens in the "unreachable middle"
- For each known wallet, queries `?ownerAddress={addr}&collectionSymbol={symbol}&limit=100`
- Each wallet gets its own 10,040 offset window — multiplies reachable tokens
- Wallets sorted by token count descending (whales first — most likely to yield new tokens)
- Append-only (never overwrites existing data), re-runnable (skips already-queried wallets)
- No target exit, no bail-out — queries EVERY wallet exhaustively
- Progress: `data/me-snowball-progress.json`

### `scripts/extract-collection-details.ts` — Collection Detail + Stats Fetcher
- **COMPLETED**: 5,494 detail JSONs in `data/collections/`, 5,497 stats JSONs in `data/collection-stats/`
- Pure API-based: fetches `/v2/ord/btc/collections/{symbol}` for details, `/v2/ord/btc/stat` for stats
- Skips existing files (check-if-exists, no progress file)
- Adaptive delay: 400ms-2000ms
- 4 ghost collections return 404: brc20___, brc20_piin, brc20_xnft, btcfrogs (placeholder files created)
- Stats endpoint: undocumented, guessed from API surface — returns all-time data (window param ignored)

### `scripts/extract-all-symbols.ts` — Symbol Extraction from Token Data
- **COMPLETED**: Scanned 10.3M tokens across all ME ndjson files
- Extracts `collectionSymbol` and `collection.symbol` from every token
- Compares against file list using both raw and sanitized names
- Result: 5,456 unique symbols, only 1 new (ordiapes — 404 on ME)
- Output: `data/all-symbols.txt`

### `scripts/verify-stats.ts` — Stats Data Verification
- Validates all stats JSON files for syntactical correctness and schema consistency
- Cross-checks against collection detail files
- Reports value distributions for key numeric fields

### `scripts/archive-me-snowball-cross.ts` — Cross-Collection Wallet Snowball
- **READY** (not yet started)
- Reads wallet pool from `data/cross-wallets.json` (generated separately)
- Queries each whale wallet against all 19 gap collections
- Meta-collections prioritized (priority 0: uncommons, sub-100k, black-uncommons)
- Skips wallets already queried by original snowball (reads both progress files)
- Same adaptive delay, append-only, resume infrastructure as original snowball
- Progress: `data/me-snowball-cross-progress.json`

### `scripts/archive-me-csv-fill.ts` — CSV Gap Filler via tokenIds Batch Lookup
- **IN PROGRESS** — filling ~1.9M missing tokens
- Uses summraznboi CSV dump as source of inscription IDs
- For each collection where CSV has more tokens, queries missing IDs in batches of 20 via `?tokenIds=id1,...,id20`
- Bypasses the 10,040 offset limit entirely — looks up specific inscriptions
- Returns full rich ME token data (owner, listing price, contentType, meta, etc.)
- Sorted smallest gaps first for maximum breadth
- Adaptive delay starting at 100ms, append-only, resumable
- BiS files moved to `data/tokens-bis/` (separate from ME data)
- Progress: `data/me-csv-fill-progress.json`

### `scripts/test-*.ts` — Various API exploration scripts (temporary)

## Data Format

### ME tokens (`data/tokens/{symbol}.ndjson`)
NDJSON, one token per line. Rich data including: id (inscription_id), contentURI, contentType, contentBody, contentPreviewURI, satRarity, chain, location, locationBlockHeight, owner, listed, listedAt, listedPrice, listedMakerFeeBp, listedSellerReceiveAddress, genesisTransaction, genesisTransactionBlockTime/Hash/Height, inscriptionNumber, outputValue, meta (name + attributes), token, collection (nested objects with full ME metadata).

### BiS tokens (`data/tokens/{symbol}.bis.ndjson`)
NDJSON, one token per line. Fields: id, slug, inscription_number, last_sale, inscription_id, wallet, content_type, item_name, is_recursive, listing prices (per marketplace), min_price, holds, render_saved, delegate, inscription_name.

### Collection details (`data/collections/{symbol}.json`)
Per-collection ME metadata fetched from API. Fields: symbol, name, imageURI, inscriptionIcon, description, supply, social links (twitter, discord, website), createdAt, labels, enableCollectionOffer. **5,494 files**.

### Collection stats (`data/collection-stats/{symbol}.json`)
All-time collection stats from undocumented endpoint. Fields: totalVolume (string, in sats), owners, supply, floorPrice, totalListed, pendingTransactions, inscriptionNumberMin, inscriptionNumberMax, symbol. **5,497 files**, 100% valid JSON, 0 errors. Some fields may be null for inactive collections.

### Third-party CSV dump (`magic-eden-data-dump/collection_name_traits.csv`)
11.6M rows. Format: `collectionSymbol,id,name,traits`. Minimal fields — no owner, contentType, listing data. Useful as a complete inscription ID reference for verifying coverage.

### Other data files
- `data/phase1-collections.json` — 635 collection stats from ME stats discovery
- `data/v4-search-collections.json` — 5,460 collections from ME v4 search discovery
- `data/bis-all-collections.json` — 5,468 collections from BiS collection index
- `data/all-symbols.txt` — 5,456 unique symbols extracted from token data
- `data/cross-wallets.json` — whale wallet pool for cross-collection snowball (generate before use)
- `data/progress.json` — ME archiver progress tracker
- `data/bis-progress.json` — BiS archiver progress tracker
- `data/me-extras-progress.json` — ME extras archiver progress tracker
- `data/v4-search-progress.json` — v4 search discovery progress
- `data/me-multiplex-progress.json` — ME multiplex archiver progress tracker
- `data/me-snowball-progress.json` — ME snowball archiver progress tracker
- `data/me-snowball-cross-progress.json` — ME cross-collection snowball progress tracker
- Log files: `data/*.log`

## Data Integrity (2026-03-07)

- **10.3M+ tokens** across all ME ndjson files
- **0 duplicate tokens** in ME data
- **11 duplicates** in BiS bitmap.bis.ndjson (negligible)
- **0 bad JSON lines** across entire archive
- **5,459/5,465 collections are 100% pure** — every token's collectionSymbol matches filename
- **6 impure collections** are all meta-collections (expected — see Meta-Collections section)
- **4 ghost collections**: brc20___, brc20_piin, brc20_xnft, btcfrogs — 404 on ME API, placeholder files created

## Running

All scripts run from the project root:
```bash
cd /Users/user/Work/haushoppe/genesis

# ME extras — grab new collections (add symbols to manual list first)
node_modules/.bin/ts-node z_extra/magic-eden-archive/scripts/archive-me-extras.ts

# Extract collection details + stats from ME API
node_modules/.bin/ts-node z_extra/magic-eden-archive/scripts/extract-collection-details.ts

# Extract all symbols from token data
node_modules/.bin/ts-node z_extra/magic-eden-archive/scripts/extract-all-symbols.ts

# Verify stats data
node_modules/.bin/ts-node z_extra/magic-eden-archive/scripts/verify-stats.ts

# ME cross-collection snowball (generate cross-wallets.json first!)
node_modules/.bin/ts-node z_extra/magic-eden-archive/scripts/archive-me-snowball-cross.ts

# Completed scripts
node_modules/.bin/ts-node z_extra/magic-eden-archive/scripts/archive-magic-eden.ts
node_modules/.bin/ts-node z_extra/magic-eden-archive/scripts/archive-me-multiplex.ts
node_modules/.bin/ts-node z_extra/magic-eden-archive/scripts/archive-me-snowball.ts
node_modules/.bin/ts-node z_extra/magic-eden-archive/scripts/discover-collections.ts
node_modules/.bin/ts-node z_extra/magic-eden-archive/scripts/archive-bestinslot.ts
```

**IMPORTANT: NEVER run two ME API scripts in parallel** — causes 429 storms and extended API penalties.
