#!/usr/bin/env bash
# Index the cubes minted on this regtest stack with the code that indexes
# mainnet: ordinal-cubes-index's grind.mjs (walks ord, recognises cube bodies,
# names them by position) and rarity.mjs (resolves every side, scores and ranks
# the cubes), at the sha pinned in cubes-index.env.
#
# Writes cubes.json, cursor.json, sides.json and rarity.json to
# e2e/regtest/.cubes-index/data/, which the regtest build serves at
# /regtest-cubes-index (angular.json) and environment.regtest.ts names as its
# cubesIndexBase. Incremental like the production grind: a second run picks up
# only the cubes minted since the first.
#
# Usage:  ./e2e/regtest/build-cubes-index.sh
# Reads:  CUBES_INDEX_SRC (an ordinal-cubes-index checkout that has the pinned
#         commit; default: the workspace sibling), E2E_ORD_STOCK_HOST_PORT
#         (default 8081), E2E_ELECTRS_HOST_PORT (default 3010)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$(cd "$HERE/../.." && pwd)"
ORD="http://127.0.0.1:${E2E_ORD_STOCK_HOST_PORT:-8081}"
ESPLORA="http://127.0.0.1:${E2E_ELECTRS_HOST_PORT:-3010}"
SRC="${CUBES_INDEX_SRC:-$(cd "$APP/../../.." && pwd)/ordinal-cubes-index}"
WORK="$HERE/.cubes-index"
CODE="$WORK/code"
DATA="$WORK/data"
GENERATED="$APP/src/environments/regtest-inscriptions.generated.ts"

# shellcheck source=/dev/null
. "$HERE/cubes-index.env"

# --- the pinned code, exactly ---------------------------------------------
# Extracted from the pinned commit rather than run from the checkout's working
# tree, so a local checkout on another revision (the production repo commits a
# grind run every few minutes) still runs exactly the pinned scripts.
git -C "$SRC" cat-file -e "${ORDINAL_CUBES_INDEX_SHA}^{commit}" 2>/dev/null || {
  echo "ordinal-cubes-index at $SRC does not have $ORDINAL_CUBES_INDEX_SHA; fetch it or set CUBES_INDEX_SRC" >&2
  exit 1
}
rm -rf "$CODE"
mkdir -p "$CODE" "$DATA"
git -C "$SRC" archive "$ORDINAL_CUBES_INDEX_SHA" scripts package.json | tar -x -C "$CODE"

# --- the ids this chain uses ----------------------------------------------
read_generated() {
  node -e "
    const src = require('fs').readFileSync(process.argv[1], 'utf8');
    const m = src.match(new RegExp(process.argv[2] + \": '([0-9a-f]{64}i[0-9]+)'\"));
    if (!m) { console.error('no ' + process.argv[2] + ' id in ' + process.argv[1] + '; run inscribe-fixtures.sh'); process.exit(1); }
    process.stdout.write(m[1]);
  " "$GENERATED" "$1"
}
RENDERER="$(read_generated cubeRenderer)"
DEPS="$(read_generated rendererDeps)"

inscription_json() {
  curl -fsS -H 'Accept: application/json' "$ORD/inscription/$1"
}

# --- the starting cursor --------------------------------------------------
# The grind continues from cursor.json. A cursor whose inscription this chain
# does not know belongs to an earlier chain (the stack was recreated), so its
# index is dropped with it.
if [ -f "$DATA/cursor.json" ]; then
  CURSOR_ID="$(node -e "process.stdout.write(require(process.argv[1]).lastScannedId)" "$DATA/cursor.json")"
  if ! inscription_json "$CURSOR_ID" >/dev/null 2>&1; then
    echo "cubes index cursor $CURSOR_ID is not on this chain, starting over" >&2
    rm -f "$DATA"/*.json
  fi
fi

# A fresh index starts at inscription 0, which the grind treats as already
# scanned. On this stack that is the renderer's dependency bundle, the first
# thing inscribe-fixtures.sh inscribes, and never a cube; checked rather than
# assumed, because a cube at 0 would silently never be indexed.
if [ ! -f "$DATA/cursor.json" ]; then
  FIRST="$(inscription_json 0)"
  FIRST_ID="$(node -e "process.stdout.write(JSON.parse(process.argv[1]).id)" "$FIRST")"
  if [ "$FIRST_ID" != "$DEPS" ]; then
    echo "inscription 0 is $FIRST_ID, expected the renderer dependency bundle $DEPS" >&2
    exit 1
  fi
  echo '[]' > "$DATA/cubes.json"
  node -e "
    const meta = JSON.parse(process.argv[1]);
    require('fs').writeFileSync(process.argv[2], JSON.stringify({
      lastScannedId: meta.id,
      lastScannedNumber: meta.number,
      lastScannedBlockHeight: meta.height,
      lastScannedBlockTimestamp: meta.timestamp,
      blessedTipAtLastRun: meta.number,
      lastScanAt: new Date().toISOString(),
      source: 'regtest-start',
    }, null, 2) + '\n');
  " "$FIRST" "$DATA/cursor.json"
fi

# --- grind, then rarity, as the production workflow runs them -------------
# The Magic Eden archive knows only mainnet ids, so this chain has none: an
# empty directory is the archive with no collections in it.
mkdir -p "$WORK/archive"
# The side probe dumps a page's DOM from a headless browser. Playwright installs
# a headless shell beside its Chromium, same revision; that is the binary for a
# DOM dump (measured on macOS: the full Chrome for Testing never printed one).
CHROME="$(cd "$APP" && node -e "
  const fs = require('fs'), path = require('path');
  const full = require('@playwright/test').chromium.executablePath();
  const m = full.match(/^(.*)[\\\\/]chromium-(\\d+)[\\\\/]/);
  if (!m) { console.error('cannot read the Chromium revision from ' + full); process.exit(1); }
  const dir = path.join(m[1], 'chromium_headless_shell-' + m[2]);
  const sub = fs.existsSync(dir) ? fs.readdirSync(dir).find((d) => fs.existsSync(path.join(dir, d, 'chrome-headless-shell'))) : undefined;
  if (!sub) { console.error('no chrome-headless-shell under ' + dir + '; run playwright install chromium'); process.exit(1); }
  process.stdout.write(path.join(dir, sub, 'chrome-headless-shell'));
")"
# Background services (component updates, sync, GCM) would reach Google's
# hosts; the probe needs nothing but the regtest ord.
export CHROME_EXTRA_ARGS="--disable-background-networking --disable-component-update --disable-sync"


export DATA_DIR="$DATA"
export ORD_BASE="$ORD"
export ESPLORA_BASE="$ESPLORA"
export CONTENT_BASE="$ORD"
export ARCHIVE_BASE="file://$WORK/archive"
export CUBE_RENDERER_ID_V3="$RENDERER"
export CHROME_BIN="$CHROME"

STOP_AT_TIP=1 MAX_ITERATIONS=100000 node "$CODE/scripts/grind.mjs" >&2
if [ "$(node -e "process.stdout.write(String(require(process.argv[1]).length))" "$DATA/cubes.json")" -gt 0 ]; then
  # The probe discards the browser's stderr, so a browser that cannot start at
  # all reads there as "incomplete". When there are sides to probe, start it once
  # on a trivial page and fail with its own message when no DOM comes back.
  PREFLIGHT="$(mktemp -d)"
  echo '<html><body>preflight</body></html>' > "$PREFLIGHT/p.html"
  # shellcheck disable=SC2086
  if ! "$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir="$PREFLIGHT/profile" \
      $CHROME_EXTRA_ARGS --dump-dom "file://$PREFLIGHT/p.html" > "$PREFLIGHT/out" 2> "$PREFLIGHT/err" \
      || ! grep -q preflight "$PREFLIGHT/out"; then
    echo "the side probe's browser printed no DOM ($CHROME):" >&2
    cat "$PREFLIGHT/err" >&2
    exit 1
  fi
  rm -rf "$PREFLIGHT"
fi
node "$CODE/scripts/rarity.mjs" >&2

echo "cubes index: $(node -e "process.stdout.write(String(require(process.argv[1]).length))" "$DATA/cubes.json") cube(s) in $DATA" >&2
