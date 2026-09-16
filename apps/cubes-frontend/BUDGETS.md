# Bundle budgets, and why they are where they are

`angular.json` warns above **1.95 MB** on the initial bundle. The app measures
about 1.86 MB, so roughly 90 kB of headroom before the warning returns.

## Why it is not 1.5 MB any more

It was, and the app measured 1.46 MB under it. On 2026-09-16 the same
application code, unchanged, measured 1.85 MB against a newer `ordpool-sdk`.
Verified by building twice with only the pin changed and both caches cleared:

    ordpool-sdk df74d03   1.46 MB raw / 333 kB transfer
    ordpool-sdk cc101f7   1.85 MB raw / 402 kB transfer

The cause is the SDK's collapse to a single CommonJS build (`8b642a8`), not
anything in this repo and not the connect-dialog change that prompted the
measurement. The SDK session reproduced the same effect independently on
cat21.space: 1.38 MB to 1.91 MB, +543 kB. CommonJS was not optional for the
family: cat21-indexer's backend is a CommonJS NestJS app that imports from the
SDK's `/core` entry, and a CommonJS app cannot `require()` an ESM package. The
maintainer took that trade knowingly.

## Why the budget was raised rather than left failing

A budget that is exceeded on every single build stops being read, and then the
next real regression arrives inside a warning everyone has learned to skip. A
budget is only a signal while it is normally green.

## What would let it come back down

Making the SDK's connector roster lazy, so a page loads only the chosen
wallet's connector. `WalletService` pulls the whole roster eagerly today, the
roster includes Xverse, and Xverse genuinely needs `sats-connect`, which is
about 171 kB. That is SDK-side work. If it lands, lower this number again: a
budget that tracks reality is worth more than a comfortable one.

## What will NOT help, and was tried

Splitting our own imports onto the SDK's new subpaths (`/format`, `/family`,
`/inscribe-fee`). Correct hygiene, and worth doing on its own merits, but it
cannot recover this: `app.config.ts` constructs `WalletService`,
`Cat21Service` and `UtxoContentScanner` at bootstrap, so the barrel and its
connectors are already loaded before any subpath could avoid them.
