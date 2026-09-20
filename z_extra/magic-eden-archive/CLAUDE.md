# Magic Eden Ordinals Archive

A frozen emergency archive of Magic Eden's ordinals data, taken before they shut their Bitcoin business down. cubes.haushoppe.art depended on that API for collection browsing and cube suggestions.

**Not the published archive.** This is the RAW capture. The public dataset
served at `ordpool-space.github.io/magic-eden-ordinals-archive/` is a separate
repo with its own, smaller numbers (5,466 collections, 8.4M inscription ids).
Two correct counts of two different artifacts: do not reconcile them into one.

**Complete and immutable since 2026-03-27.** The API it came from no longer exists, so nothing here can be re-run and nothing can be added. The numbers below describe a frozen dataset and will not drift.

## What the archive holds

| Data | Count | Coverage | Notes |
|---|---|---|---|
| Tokens (ME) | 12.7M across 5,480 files | | full metadata: owner, listing, contentType |
| Tokens (BiS) | ~3M, 13+ collections | | bitmap 920K, btc-name 2M, runestone 112K |
| Collection details | 5,497 | 100% | name, description, socials, supply |
| Collection stats | 5,497 | 100% | totalVolume, floorPrice, owners, supply |
| Attribute stats | 5,468 | 99.5% | per-trait floor prices, counts, sample images |
| Collection images | 5,448 | 99.3% | in `data/collections/`, beside the JSONs |
| Activities / sales | 204 | 3.7% | 315K records; see below |

Zero duplicate tokens in the ME data (11 in the BiS bitmap set).

## What is permanently lost

- **Activities and sales history.** ME killed `/v4/activity/nft` (404) and `/v2/ord/btc/activities` on 2026-03-09, eighteen days before the announced deadline. Only 204 alphabetically-early, low-volume collections were captured. Every top collection is missing: nodemonkes, bitcoin-puppets, quantum_cats and the rest. Satflow holds partial external data (~914 nodemonkes trades), not the full history.
- **Sparklines.** `/collection_stats/getCollectionSparkline/{symbol}` was already dead. Params unknown, and ME's own frontend did not use it for ordinals.
- **40 collection images.** 36 expired Airtable signed URLs, 2 broken ME mirrors, 2 invalid. Only three have no `inscriptionIcon` fallback: `odnptacosclub`, `shadow-grails`, `shadow-omb`.

## RULE: ME symbols are the canonical identifier

- BiS uses different slugs for the same collections (~724 of them). ME `bitcoin-punks` is BiS `bitcoinpunks`.
- Key everything on the ME symbol; treat a BiS slug as an alias.

## RULE: Six collections are meta-collections and their token files are not what they look like

- `uncommons`, `sub-100k`, `black-uncommons`, `sub-100`, `sub-10k`, `sub-1k` group tokens by SAT ATTRIBUTE rather than by minting origin.
- Querying one with `?ownerAddress=X&collectionSymbol={meta}` made the API ignore the symbol filter and return the wallet's entire portfolio, which is why those snowball runs exploded (20K to 724K tokens).
- All six are 0% pure: no token's own `collectionSymbol` matches the filename. `uncommons` spans 3,605 distinct symbols, `sub-100k` spans 1,686.
- The other 5,459 of 5,465 collections are 100% pure, so a consumer can trust the filename everywhere else.

## Why the token counts are shaped as they are

- The API (`api-mainnet.magiceden.dev`, and `.io` for some endpoints) had a hard offset limit of 10,040 on every endpoint, sort field and filter combination: `GET /v2/ord/btc/tokens?collectionSymbol={symbol}&limit=40&offset={n}`, at most 40 per page.
- Three independent windows existed (inscriptionNumberAsc, inscriptionNumberDesc, and price/listedAt sharing one), so sort multiplexing reached about 30,120 unique tokens per collection. Biggest single gain: `domain_dot_sats`, 10K to 34K.
- `?ownerAddress={addr}&collectionSymbol={symbol}&limit=100` gave each wallet its own 10,040 window and allowed 100 per page, which is how collections above the cap were filled in.

That ceiling, not an incomplete run, is why large collections are capped.

## Where the data lives

| Path | Contents |
|---|---|
| `data/collections/{symbol}.json` | collection detail |
| `data/collections/{symbol}.{ext}` | its image, beside the JSON |
| `data/collection-stats/{symbol}.json` | totalVolume, floorPrice, owners, supply |
| `data/collection-attributes/{symbol}.json` | per-trait floor prices, counts, sample images |
| `data/collection-activities/{symbol}.ndjson` | activity records, 204 collections only |
| `data/all-symbols.txt` | the 5,456 unique ME symbols |
| `data/bis-all-collections.json` | the BiS collection list |
| `data/phase1-collections.json` | the stats-discovery seed list |
| `data/*-progress.json`, `data/*.log` | per-run resume state, spent |

Token files sit beside these per collection. The `*-progress.json` files
(`progress`, `me-extras`, `me-multiplex`, `me-snowball`, `me-snowball-cross`,
`me-csv-fill`, `bis-progress`, `cross-wallets`) are resume state from runs that
can never resume, kept only as provenance.

## Provenance

Thirteen runs, all complete except where noted:

| Run | Result |
|---|---|
| `archive-magic-eden.ts` phases 1-3 | 635 collections via stats discovery |
| `archive-me-extras.ts` | 4,843 collections, 21 not found |
| `archive-bestinslot.ts` waves 1-2 | 99 gap collections |
| `archive-me-multiplex.ts` | sort multiplexing, 19 gap collections |
| `archive-me-snowball.ts` | per-collection ownerAddress snowball |
| `archive-me-snowball-cross.ts` | cross-collection wallet snowball |
| `extract-collection-details.ts` | 5,497 details + 5,497 stats |
| `extract-all-symbols.ts` | 5,456 unique symbols |
| third-party CSV import | 32 collections from the summraznboi dump |
| `archive-me-csv-fill.ts` | 2.4M tokens via tokenIds batch lookup, 0 duplicates |
| `archive-me-attribute-stats.ts` | 5,468 collections, via Playwright |
| `archive-me-activities.ts` | 204 collections, PARTIAL, endpoint killed mid-run |
| `download-collection-images.ts` | 5,448 images |

Collection details for `col`, `ol` and `ordiapes` were taken by hand with Playwright.

The image campaign ran 2026-03-18 to 26 and recovered 100% of IPFS-hosted images by rotating gateways (w3s.link, 4everland, dweb.link, runfission, best-practice.se, fleek, nftstorage) plus Filecoin retrieval via Lassie (`lassie fetch -o output.car <CID>`). Eight days of retrying; the remaining 40 are dead at the source.

## Timeline

| Date | Event |
|---|---|
| 2026-03-05 | archive started |
| 2026-03-07 | 10.3M tokens, 5,497 collections |
| 2026-03-09 | ME trading stopped; activities endpoint killed; our API key banned after 127K requests |
| 2026-03-18 to 26 | image recovery campaign |
| 2026-03-27 | ME Bitcoin API terminated, archive declared complete |
| 2026-04-01 | ME wallet retired |

## Historical, kept because it explains the data

- `MAGIC_EDEN_API_KEY` was banned on 2026-03-09 after 127K requests at 100ms spacing. A second key found in a public repo worked on the `.dev` host for non-activity endpoints. Both are moot; the API is gone.
- Rate limits at the time: 400ms was clean for token endpoints; the collection-details endpoint needed at least 400ms and held penalty state for minutes after a 429 storm. Two ME scripts must never run in parallel, which caused 429 storms and extended penalties.
- Undocumented endpoints used: `/v2/ord/btc/stat` (all-time stats, `window` ignored, 100% success across 5,497), `/v2/ord/btc/collections/{slug}/attribute_stats`, `/v4/activity/nft` (cursor pagination, killed 2026-03-09).
