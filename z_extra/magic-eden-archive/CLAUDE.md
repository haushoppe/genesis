# Magic Eden Ordinals Archive

## Purpose

Emergency archive of Magic Eden's ordinals collection data before they shut down their ordinals business. The cubes.haushoppe.art product depends on ME's API for collection browsing and cube suggestions.

## Current Status (2026-03-06)

### Archive Totals
- **5,549 token files** (ME + BiS)
- **~8.65 million tokens** archived
- **~26 GB** total data
- **824,836 unique wallet addresses** discovered
- **0 failed** collections across all scripts

### Completed Runs
1. **ME Phase 1-3** (archive-magic-eden.ts): 635 collections via stats discovery — **COMPLETED**
2. **ME Extras** (archive-me-extras.ts): 4,815 additional collections via v4 search discovery — **COMPLETED**
3. **BiS Wave 1** (archive-bestinslot.ts): 13 gap collections fully archived (incl. bitmap 920K, btc-name 2M) — **COMPLETED**
4. **BiS Wave 2** (archive-bestinslot.ts): 86 gap collections — IN PROGRESS
5. **ME Multiplex** (archive-me-multiplex.ts): Sort field multiplexing for 19 gap collections — **COMPLETED**
6. **ME Snowball** (archive-me-snowball.ts): ownerAddress-based gap filler, 2 rounds converged, +328K tokens — **COMPLETED** (final no-limits pass pending)

### Gap Collections After Snowball (2026-03-06)
Note: ME's `totalSupply` is inaccurate (e.g. uncommons reports 22K but has 22.8K+ tokens).

| Collection | Expected | Archived | Coverage |
|-----------|----------|----------|----------|
| domain_dot_bitter | 21,000 | 21,004 | 100.0% |
| uncommons | 22,000 | 22,892 | 104.1% |
| sub-100k | 90,000 | 90,767 | 100.9% |
| domain_dot_xbt | 25,000 | 23,471 | 93.9% |
| quadkey | 31,000 | 23,292 | 75.1% |
| domain_dot_ord | 32,000 | 21,384 | 66.8% |
| kards | 42,000 | 27,834 | 66.3% |
| thissongaboutnfts | 42,000 | 29,888 | 71.2% |
| runeratscoin | 50,000 | 31,131 | 62.3% |
| dogo | 50,000 | 29,577 | 59.2% |
| ainnrunestar | 94,000 | 26,934 | 28.7% |
| sat20_rarepizza | 99,000 | 41,578 | 42.0% |
| gamestone | 113,000 | 29,633 | 26.2% |
| uniworlds-genesis | 115,000 | 28,077 | 24.4% |
| brc1024_rootverse | 210,000 | 56,935 | 27.1% |
| bitman | 210,000 | 55,631 | 26.5% |
| domain_dot_unisat | 232,033 | 31,458 | 13.6% |
| rare-sats | 239,240 | 0 | 0.0% |
| domain_dot_sats | 489,739 | 87,188 | 17.8% |

## API Key

`MAGIC_EDEN_API_KEY` is in the project root `.env`. Rate limiting tested: ME dev API handles 400ms delay with zero 429s. The adaptive delay system (400ms-2000ms) in archive-me-extras.ts ran the entire 4,815 collection crawl without a single rate limit hit.

## Architecture

### Data Sources

#### 1. Magic Eden Developer API (`api-mainnet.magiceden.dev`)
- Requires `MAGIC_EDEN_API_KEY` in `Authorization: Bearer` header
- **Hard offset limit: 10,040** — confirmed on all endpoints, all sort fields, all filter combos
- `GET /v2/ord/btc/tokens?collectionSymbol={symbol}&limit=40&offset={n}` — max 40 per page
- `GET /collection_stats/search/bitcoin` — collection discovery (offset 0-1000, found 635 collections)
- `GET /v2/ord/btc/collections/{symbol}` — collection metadata
- Forward+reverse pass strategy: inscriptionNumberAsc from offset 0 + inscriptionNumberDesc from offset 0 = max ~20,080 unique tokens per collection
- **Rate limiting**: Adaptive 400ms-2000ms works perfectly. 400ms sustained with zero 429s over 4,815 collections.

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

### ME Meta-Collections
Some ME collections are **meta-collections** that group tokens by sat attributes, not by minting origin. Example: `uncommons` contains tokens whose primary `collectionSymbol` is `rare-sats`, `idiots`, `cursed-sharks`, `bitmap`, `nodemonkes`, etc. — ME considers them part of `uncommons` because they sit on uncommon sats. The token's own `collectionSymbol` field reflects the PRIMARY collection, not the queried one. This is normal ME behavior, not data contamination. Most collections (e.g. `kards`, `domain_dot_bitter`) are pure — 100% of tokens have matching `collectionSymbol`. The `uncommons` totalSupply stat (22K) was also inaccurate — actual count exceeded 22.8K.

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

#### Alternative APIs (ALL Dead Ends for these 19 collections)
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
- **COMPLETED**: 4,815 collections, 17 not found, 0 failed
- Sources: manual list + legacy repo (152) + v4 search discovery (5,460)
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
- **COMPLETED** (2 rounds converged, +328K tokens) — final no-limits pass pending
- Queries known wallet addresses to find tokens in the "unreachable middle"
- For each known wallet, queries `?ownerAddress={addr}&collectionSymbol={symbol}&limit=100`
- Each wallet gets its own 10,040 offset window — multiplies reachable tokens
- Wallets sorted by token count descending (whales first — most likely to yield new tokens)
- Append-only (never overwrites existing data), re-runnable (skips already-queried wallets)
- Progress: `data/me-snowball-progress.json`

### `scripts/test-*.ts` — Various API exploration scripts (temporary)

## Data Format

### ME tokens (`data/tokens/{symbol}.ndjson`)
NDJSON, one token per line. Fields include: id (inscription_id), contentURI, contentType, contentBody, contentPreviewURI, satRarity, chain, location, locationBlockHeight, owner, listedPrice, token, collection (nested objects with full ME metadata).

### BiS tokens (`data/tokens/{symbol}.bis.ndjson`)
NDJSON, one token per line. Fields: id, slug, inscription_number, last_sale, inscription_id, wallet, content_type, item_name, is_recursive, listing prices (per marketplace), min_price, holds, render_saved, delegate, inscription_name.

### Other data files
- `data/phase1-collections.json` — 635 collection stats from ME stats discovery
- `data/v4-search-collections.json` — 5,460 collections from ME v4 search discovery
- `data/bis-all-collections.json` — 5,468 collections from BiS collection index
- `data/collections/{symbol}.json` — per-collection ME metadata
- `data/progress.json` — ME archiver progress tracker
- `data/bis-progress.json` — BiS archiver progress tracker
- `data/me-extras-progress.json` — ME extras archiver progress tracker
- `data/v4-search-progress.json` — v4 search discovery progress
- `data/me-multiplex-progress.json` — ME multiplex archiver progress tracker
- `data/me-snowball-progress.json` — ME snowball archiver progress tracker
- `data/archive.log` / `data/bis-archive.log` / `data/me-extras.log` / `data/v4-search.log` / `data/me-multiplex.log` / `data/me-snowball.log`

## Validation Results (2026-03-04)

### Supply Check
- **5,148 collections** (94.5%) = 100%+ of expected supply
- **156 collections** = 95-99% of expected supply
- **118 collections** have >5% gap (86 being filled by BiS Wave 2)
- **0 duplicate tokens** in ME data, 11 dupes in BiS bitmap (negligible)
- **5 empty files**: rare-sats, btcfrogs, brc20___, brc20_piin, brc20_xnft
- **0 bad JSON lines** across entire archive

### Unfillable Gaps (not on BiS)
19 collections with gaps that cannot be filled — no alternative data source found:
- domain_dot_sats (490K), rare-sats (239K), domain_dot_unisat (232K), bitman (210K), brc1024_rootverse (210K), gamestone (113K), uniworlds-genesis (115K), sat20_rarepizza (99K), ainnrunestar (94K), sub-100k (90K), dogo (50K), runeratscoin (50K), thissongaboutnfts (42K), kards (42K), domain_dot_ord (32K), quadkey (31K), domain_dot_xbt (25K), domain_dot_bitter (21K), uncommons (22K)

## Running

```bash
cd /Users/user/Work/haushoppe/genesis

# ME archiver (COMPLETED)
npx ts-node z_extra/magic-eden-archive/scripts/archive-magic-eden.ts

# ME extras archiver (COMPLETED — 4,815 collections)
npx ts-node z_extra/magic-eden-archive/scripts/archive-me-extras.ts

# v4 search discovery (COMPLETED — 5,460 collections)
npx ts-node z_extra/magic-eden-archive/scripts/discover-collections.ts

# BiS archiver — Wave 1 + Wave 2 (Wave 1 complete, Wave 2 in progress)
npx ts-node z_extra/magic-eden-archive/scripts/archive-bestinslot.ts

# ME sort field multiplexing (COMPLETED — 19 gap collections)
npx ts-node z_extra/magic-eden-archive/scripts/archive-me-multiplex.ts

# ME ownerAddress snowball (IN PROGRESS — 19 gap collections)
npx ts-node z_extra/magic-eden-archive/scripts/archive-me-snowball.ts
```
