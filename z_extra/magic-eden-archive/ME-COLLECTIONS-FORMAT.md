# ME-COLLECTIONS-FORMAT.md

Plan for archiving Magic Eden ordinals data into a final format that is compatible with the
[ordinals-collections](https://github.com/TheWizardsOfOrd/ordinals-collections) legacy standard
while preserving all important data from Magic Eden.

---

## 1. What We Get From Magic Eden

### 1.1 Collection Statistics (Phase 1)

Source: `GET /collection_stats/search/bitcoin`
File: `data/phase1-collections.json` — array of all unique collections discovered

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `collectionSymbol` | string | `"runestone"` | Primary key, matches `symbol` elsewhere |
| `name` | string | `"Runestone"` | Display name |
| `image` | string | `"https://media.cdn.magiceden.dev/..."` | Collection image (ME CDN) |
| `totalSupply` | number | `112384` | Total items in collection |
| `ownerCount` | number | `64052` | Unique holders |
| `uniqueOwnerRatio` | number | `0.5699` | ownerCount / totalSupply |
| `listedCount` | number | `2986` | Currently listed for sale |
| `fp` | number | `0.0014` | Floor price in BTC |
| `fpListingPrice` | number | `0.0014` | Floor price from listing |
| `fpListingCurrency` | string | `"BTC"` | Currency of floor listing |
| `fpPctChg` | number | `36.72` | Floor price % change in window |
| `vol` | number | `4.5985` | Volume in current window (BTC) |
| `totalVol` | number | `4036.47` | All-time volume (BTC) |
| `volPctChg` | number | `82.25` | Volume % change in window |
| `txns` | number | `3099` | Transactions in window |
| `totalTxns` | number | `184911` | All-time transactions |
| `txnsPctChg` | number | `45.22` | Transactions % change in window |
| `marketCap` | number | `157.34` | Market cap in BTC |
| `marketCapUsd` | number | `10446855` | Market cap in USD |
| `currency` | string | `"BTC"` | Base currency |
| `currencyUsdRate` | number | `66397.70` | USD conversion rate at query time |
| `minted` | number | `0` | Items minted in window |
| `mintedVol` | number | `0` | Minting volume in window |
| `pending` | number | `0` | Pending items |
| `highestGlobalOfferBidCurrency` | string | `"BTC"` | Offer currency |
| `cohort` | string | `"ordinal"` | Collection type |
| `isCompressed` | boolean | `false` | Compression flag |
| `hasInscriptions` | boolean | `false` | Has inscriptions flag |
| `fpSparkLinePath` | string | `"/collection_stats/..."` | Sparkline chart endpoint |
| `collectionId` | string | `"runestone"` | Same as collectionSymbol |

**Verdict:** Mostly volatile marketplace data (prices, volumes, % changes).
Useful to keep: `totalSupply`, `ownerCount`, `totalVol`, `totalTxns`, `marketCap` as a historical snapshot.
Everything window-relative (% changes, sparklines, current listings) is ephemeral.

### 1.2 Collection Details (Phase 2)

Source: `GET /v2/ord/btc/collections/{symbol}`
File: `data/collections/{symbol}.json` — one file per collection

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `symbol` | string | `"umwelt"` | **Primary key** |
| `name` | string | `"The Umwelt AI by FAR"` | Display name |
| `imageURI` | string | `"https://creator-hub-prod.s3..."` | Collection PFP image |
| `chain` | string | `"btc"` | Always "btc" |
| `inscriptionIcon` | string | `"abc123...i0"` | Inscription ID used as icon (can be empty) |
| `description` | string | `"The Umwelt AI is..."` | Full description |
| `supply` | number | `512` | Total supply |
| `twitterLink` | string | `"https://twitter.com/0xfar"` | Social link (can be empty) |
| `discordLink` | string | `""` | Social link (can be empty) |
| `websiteLink` | string | `"https://theumwelt.xyz/"` | Website (can be empty) |
| `createdAt` | string | `"Sat, 10 Jun 2023..."` | RFC format creation date |
| `overrideContentType` | string\|null | `""` | ME-internal |
| `disableRichThumbnailGeneration` | bool\|null | `false` | ME-internal |
| `disableRichDetailGeneration` | bool\|null | `null` | ME-internal |
| `labels` | string[] | `["ART"]` | Tags |
| `creatorTipsAddress` | string | `"bc1qxkpass..."` | Creator's BTC address |
| `enableCollectionOffer` | boolean | `true` | ME marketplace feature |

**Verdict:** This is the core collection metadata.
Directly equivalent to `ordinals-collections/legacy/collections.json` entries — same source (ME API).

### 1.3 Token Data (Phase 3)

Source: `GET /v2/ord/btc/tokens?collectionSymbol={symbol}`
Files: `data/tokens/{symbol}.ndjson` (or `.json` for early collections)

Each token record has **~40 fields**:

#### Identity (KEEP)
| Field | Type | Example |
|-------|------|---------|
| `id` | string | `"dc2cc0...i0"` |
| `inscriptionNumber` | number | `10862` |
| `contentType` | string | `"image/webp"` |

#### Metadata (KEEP)
| Field | Type | Example |
|-------|------|---------|
| `meta.name` | string | `"#006 - Alpaca"` |
| `meta.attributes` | array | `[{trait_type: "body", value: "normie"}]` |

#### Genesis / Creation (KEEP)
| Field | Type | Example |
|-------|------|---------|
| `genesisTransaction` | string | `"dc2cc0c4..."` |
| `genesisTransactionBlockTime` | string | `"Tue, 07 Feb 2023..."` |
| `genesisTransactionBlockHash` | string | `"00000000..."` |
| `genesisTransactionBlockHeight` | number | `775444` |

#### Satoshi Rarity (KEEP)
| Field | Type | Example |
|-------|------|---------|
| `sat` | number | `896288815181813` |
| `satName` | string | `"hmrcymttzzo"` |
| `satRarity` | string | `"common"` |
| `satBlockHeight` | number | `123456` |
| `satBlockTime` | string | `"..."` |
| `satributes` | string[] | `["Common"]` |

#### Derivable URLs (DROP)
| Field | Type | Notes |
|-------|------|-------|
| `contentURI` | string | = `https://ord-mirror.magiceden.dev/content/{id}` |
| `contentPreviewURI` | string | = `https://ord-mirror.magiceden.dev/preview/{id}` |

#### Volatile Marketplace Data (DROP)
| Field | Type | Notes |
|-------|------|-------|
| `owner` | string | Changes on every sale |
| `listed` | boolean | Ephemeral |
| `listedAt` | string | Ephemeral |
| `listedPrice` | number | Ephemeral |
| `listedMakerFeeBp` | number | ME-specific |
| `listedSellerReceiveAddress` | string | Ephemeral |
| `listedForMint` | boolean | ME-specific |
| `location` | string | Changes on every transfer |
| `locationBlockHeight` | number | Changes on every transfer |
| `locationBlockTime` | string | Changes on every transfer |
| `locationBlockHash` | string | Changes on every transfer |
| `output` | string | Changes on every transfer |
| `outputValue` | number | Changes on every transfer |

#### Redundant (DROP)
| Field | Type | Notes |
|-------|------|-------|
| `chain` | string | Always "btc" |
| `collectionSymbol` | string | Already the filename |
| `collection` | object | **Entire collection object repeated per token!** |
| `itemType` | string | Always "Inscription" |

#### Extra API Fields (KEEP selectively)
| Field | Type | Notes |
|-------|------|-------|
| `displayName` | string | Sometimes differs from meta.name |
| `lastSalePrice` | number | Historical data point |

---

## 2. The ordinals-collections/legacy Format

### 2.1 `legacy/collections.json` — Collection Index

A single JSON array with 537 entries. Each entry is collection metadata from Magic Eden:

```json
[
  {
    "symbol": "122-bitcoin-llamaz",
    "name": "122 Bitcoin LLaMAZ",
    "imageURI": "https://bafybei...ipfs.nftstorage.link/",
    "chain": "btc",
    "inscriptionIcon": "3ce9ced...i0",
    "description": "Presenting the extraordinary 122 Bitcoin LLaMaz...",
    "supply": 122,
    "twitterLink": "https://twitter.com/Bitcoinllamaz",
    "discordLink": "https://discord.gg/fineart2hodl",
    "websiteLink": "https://fineart2hodl.com/",
    "createdAt": "Thu, 23 Mar 2023 06:23:00 GMT",
    "overrideContentType": null,
    "disableRichThumbnailGeneration": null,
    "disableRichDetailGeneration": null,
    "labels": [],
    "enableCollectionOffer": true
  }
]
```

This is **identical** to what our Phase 2 fetches (same ME API endpoint: `/v2/ord/btc/collections/{symbol}`).
Some entries also have `coinMarketCapLink`, `telegramLink`, `creatorTipsAddress`, `useObjectTag`.

### 2.2 `legacy/collections/{symbol}.json` — Per-Collection Token Lists

One JSON file per collection. A simple array of token objects with minimal data:

```json
[
  {
    "id": "d29997a835a38d2c5aed46788c277b4ba1a728bc79313bb505c0ad4e30e68c64i0",
    "meta": {
      "name": "Obama Card",
      "attributes": [
        { "trait_type": "Heart", "value": "15" },
        { "trait_type": "Atk", "value": "3" }
      ]
    }
  },
  {
    "id": "035a893f3b2c7861ab1c4b5044bf4113a8a36c4418c8afa9194a6750effa60f4ci0"
  }
]
```

Key observations:
- `meta` is **optional** — some tokens have just `id`
- `meta.attributes` is **optional** — some tokens have `meta.name` only, with empty `attributes: []`
- No `contentType`, no `inscriptionNumber`, no genesis data, no sat rarity
- Extremely compact: **just the inscription ID and traits**
- 537 files, ~1.1 GB total (for comparison: our raw dump is 7.8 GB for ~635 collections)

### 2.3 Root `collections.json` — Curated Index (174 entries)

Separate from legacy. A newer, curated format:

```json
[
  {
    "name": "Bitcoin Puppets",
    "type": "parent",
    "ids": ["5e5f4bb0...i0"],
    "slug": "bitcoin-puppets"
  },
  {
    "name": "Yuna Revelation",
    "type": "gallery",
    "id": "0441bc24...i589",
    "slug": "yunabrc"
  }
]
```

- `type: "parent"` = collection with parent inscription(s), uses `ids` array
- `type: "gallery"` = curated gallery, uses single `id`
- `slug` = URL-friendly identifier (lowercase, alphanumeric + hyphens/underscores)
- Only 174 entries (curated subset), not useful as a complete index

---

## 3. Our Final Archive Format

### Design Goals

1. **Compatible** with `ordinals-collections/legacy` where possible
2. **Preserves** important ME data that the legacy format drops
3. **Eliminates** redundancy (volatile marketplace data, repeated collection objects, derivable URLs)
4. **Single canonical format** (no mixed .json/.ndjson)

### 3.1 `collections.json` — Collection Index

Same structure as `ordinals-collections/legacy/collections.json`, but enriched with
statistics snapshot from Phase 1.

```json
[
  {
    "symbol": "umwelt",
    "name": "The Umwelt AI by FAR",
    "imageURI": "https://creator-hub-prod.s3...",
    "chain": "btc",
    "inscriptionIcon": "",
    "description": "The Umwelt AI is a fictional project...",
    "supply": 512,
    "twitterLink": "https://twitter.com/0xfar",
    "discordLink": "",
    "websiteLink": "https://theumwelt.xyz/",
    "createdAt": "Sat, 10 Jun 2023 11:11:59 GMT",
    "labels": ["ART"],
    "creatorTipsAddress": "bc1qxkpass...",

    "_stats": {
      "snapshotDate": "2024-12-15T00:00:00Z",
      "totalSupply": 512,
      "ownerCount": 312,
      "totalVol": 15.234,
      "totalTxns": 1842,
      "marketCap": 2.56,
      "floorPrice": 0.005
    }
  }
]
```

**Compatibility:**
- All fields from `ordinals-collections/legacy/collections.json` are present and identical
- Additional ME-specific fields (`overrideContentType`, `disableRichThumbnailGeneration`, etc.) preserved
- New `_stats` object (prefixed with `_` to signal it's our extension) contains the historical snapshot
- Sorted alphabetically by `symbol`

**Dropped from Phase 1 stats:**
- Window-relative metrics (% changes, window volumes/txns)
- USD conversion rates (ephemeral)
- Sparkline paths (ME-internal)
- `cohort`, `isCompressed`, `hasInscriptions` (ME-internal flags)

### 3.2 `collections/{symbol}.json` — Per-Collection Token Lists

One JSON file per collection. Extends the `ordinals-collections/legacy` format with
additional fields that ME provides and the legacy format doesn't capture.

```json
[
  {
    "id": "dc2cc0c48577a6411cfcac3168c1c692aebaef7733d97442f52817cbef9c1a4fi0",
    "meta": {
      "name": "#006 - Alpaca",
      "attributes": [
        { "trait_type": "background", "value": "touch grass" },
        { "trait_type": "body", "value": "normie" }
      ]
    },
    "inscriptionNumber": 10862,
    "contentType": "image/webp",
    "genesis": {
      "tx": "dc2cc0c48577a6411cfcac3168c1c692aebaef7733d97442f52817cbef9c1a4f",
      "blockHeight": 775444,
      "blockTime": "2023-02-07T14:45:15Z"
    },
    "sat": {
      "number": 896288815181813,
      "name": "hmrcymttzzo",
      "rarity": "common",
      "blockHeight": 123456,
      "satributes": ["Common"]
    }
  }
]
```

**Compatibility with ordinals-collections/legacy:**
- `id` — identical
- `meta.name` — identical
- `meta.attributes` — identical (same `{trait_type, value}` structure)
- Can read our files with legacy tooling (extra fields are simply ignored)

**Our extensions:**
- `inscriptionNumber` — useful for sorting and display
- `contentType` — critical for cubes (we need to know what's an image vs text vs HTML)
- `genesis` — immutable on-chain data about when/where the inscription was created
- `sat` — satoshi rarity data (only present if ME provided it, omitted if null/empty)

**What we drop from the raw ME token data:**
- `contentURI`, `contentPreviewURI` — derivable from `id`
- `owner`, `location`, `output`, `outputValue` — volatile, changes on every transfer
- `listed*` fields — volatile marketplace state
- `collection` object — redundant, already in `collections.json`
- `chain`, `collectionSymbol`, `itemType` — redundant constants

### 3.3 Output Directory Structure

```
data/
  archive/                          # final compacted archive
    collections.json                # all collections with metadata + stats snapshot
    collections/                    # per-collection token lists
      122-bitcoin-llamaz.json
      bitcoin-puppets.json
      nodemonkes.json
      runestone.json
      umwelt.json
      ...
  phase1-collections.json           # raw Phase 1 (kept for reference)
  collections/                      # raw Phase 2 (kept for reference)
  tokens/                           # raw Phase 3 (kept for reference)
  progress.json
```

---

## 4. Estimated Size After Compaction

Per token, raw ME data: **~2,000 bytes**
Per token, our compact format: **~200-400 bytes** (depending on attributes count)

| | Raw ME Dump | Our Compact | ordinals-collections/legacy |
|---|---|---|---|
| Token fields | ~40 | 6-8 | 1-3 |
| Per-token size | ~2 KB | ~300 bytes | ~150 bytes |
| Total (est.) | **7.8 GB** | **~1.2 GB** | ~1.1 GB |

We're slightly larger than ordinals-collections because we keep `inscriptionNumber`,
`contentType`, `genesis`, and `sat` data. This is a worthwhile tradeoff — these fields
are immutable on-chain data that would be expensive/impossible to re-fetch later.

---

## 5. Issues to Tackle

### 5.1 Incomplete Token Data (CRITICAL)

**11 collections hit the ME API pagination limit (offset >= 10,040).**
We have the first 10,040 tokens but are missing the tail:

| Collection | Total Supply | Tokens Fetched | Missing |
|------------|-------------|----------------|---------|
| bitmap | 839,898 | 10,040 | 829,858 |
| runestone | 112,384 | 10,040 | 102,344 |
| brc-20 | 67,769 | 10,040 | 57,729 |
| pizza-ninjas | ~15,000+ | 10,040 | ~5,000+ |
| ... | ... | ... | ... |

**Plan:** Reverse-direction fetch (`sortBy: inscriptionNumberDesc`) to get the tail.
Then merge and deduplicate. For very large collections (bitmap: 840K tokens), even two
passes won't cover everything — we may need to accept partial data.

### 5.2 Mixed File Formats in Raw Data

First ~491 collections saved as `.json` (JSON arrays), remaining as `.ndjson`.
The compaction script must handle both input formats when reading raw data.

### 5.3 18 Failed Collections

Some collections failed during Phase 3 for various reasons (not just the 10,040 limit).
Need to:
1. Categorize failures (pagination limit vs API error vs other)
2. Retry non-pagination failures
3. Document which collections have incomplete data

### 5.4 imageURI / inscriptionIcon Preservation

Collection images are hosted on various CDNs that may go offline:
- `creator-hub-prod.s3.us-east-2.amazonaws.com` (ME S3)
- `media.cdn.magiceden.dev` (ME CDN)
- `bafybei...ipfs.nftstorage.link` (IPFS)
- `arweave.net` (permanent)

**Decision needed:** Do we download and archive images? IPFS and Arweave are permanent,
but ME S3/CDN URLs will die. Could be significant storage for 635+ collection images.

### 5.5 `_stats` Snapshot Date

Phase 1 stats are a point-in-time snapshot. We need to record when the scrape happened
so the data is properly contextualized (floor prices, volumes, etc. are only meaningful
with a timestamp).

### 5.6 collections.json Sorting and Deduplication

Our Phase 1 discovered 635+ collections via 130 different query combinations.
Need to verify no duplicate symbols exist and establish canonical sort order
(alphabetical by `symbol`, matching ordinals-collections convention).

### 5.7 Tokens Without Metadata

Some tokens in our dump may have `meta: null` or empty `meta.attributes`.
This is normal — the legacy format handles this by either omitting `meta` entirely
or having `"attributes": []`. Our format should follow the same convention:
- If `meta` is null/empty: omit the `meta` field entirely (just `"id": "..."`)
- If `meta.attributes` is empty: include `"attributes": []`

### 5.8 Large Collection File Sizes

Even in compact format, large collections will produce big files:
- runestone (112K tokens): ~30-40 MB
- bitmap (840K tokens): would be ~250 MB if complete

This is fine as JSON files, but tools that load the full array into memory
need to handle this. Consider whether the very largest collections (bitmap)
should use NDJSON even in the final format, or if JSON arrays are acceptable.

### 5.9 Field Normalization

ME API returns timestamps in RFC format (`"Tue, 07 Feb 2023 14:45:15 GMT"`).
Our compact format should normalize these to ISO 8601 (`"2023-02-07T14:45:15Z"`)
for consistency and easier parsing.

### 5.10 ordinals-collections Parity Check

We should cross-reference our 635+ collections against ordinals-collections' 537
legacy collections to identify:
- Collections in both (should have matching data)
- Collections only in our dump (ME had more than the curated repo)
- Collections only in ordinals-collections (we may have missed some)
