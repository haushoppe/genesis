#!/usr/bin/env bash
# Bring up bitcoind + electrs + both ords + the ordpool backend (regtest), mine
# 101 blocks so the coinbase rewards mature, inscribe the fixtures and index the
# chain's cubes. Prints a regtest funder keypair (address + WIF) and the slot on
# stdout (as JSON) so the E2E suite can pick them up.
#
# The stack runs in a machine-wide slot (ordpool-sdk's e2e/stack-slot.sh): its
# host ports, compose project and container names come from the slot, and no
# more than ORDPOOL_E2E_MAX_STACKS stacks run on this machine at once.
#
# Usage:
#   npm run e2e:regtest:run -- --grep watchonly
#       (slot, stack, specs and teardown in one command)
#   node node_modules/ordpool-sdk/scripts/e2e-slots.mjs run --kind regtest -- bash -c 'bash e2e/regtest/regtest-bootstrap.sh && ...'
#   ./e2e/regtest/regtest-bootstrap.sh
#       (acquires a slot of its own; the stack keeps it until
#        `node node_modules/ordpool-sdk/scripts/e2e-slots.mjs down <slot>`)

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SDK_E2E="$HERE/../../node_modules/ordpool-sdk/e2e"

# shellcheck source=/dev/null
. "$SDK_E2E/stack-slot.sh"
use_stack_slot regtest

# ELECTRS_SRC / CAT21_ORD_SRC / ORDPOOL_SRC point the compose's build contexts
# at the fork checkouts. CI sets them itself; for a local run they default to
# the workspace-sibling checkouts under /Work/ordpool/. The ordpool checkout is
# the build context of the real ordpool-backend (backend/ + rust/), the
# mempool-witness renderer that serves the just-minted cube before confirmation.
export ELECTRS_SRC="${ELECTRS_SRC:-$(cd "$HERE/../../../../.." && pwd)/ordpool-electrs}"
export CAT21_ORD_SRC="${CAT21_ORD_SRC:-$(cd "$HERE/../../../../.." && pwd)/cat21-ord}"
export ORDPOOL_SRC="${ORDPOOL_SRC:-$(cd "$HERE/../../../../.." && pwd)/ordpool}"

# The electrs, cat21-ord and ordpool checkouts the compose builds from, compared
# with the SDK's build-pins.env (the copy matching package-lock.json): a mismatch
# fails under CI and is reported locally.
# shellcheck source=/dev/null
. "$SDK_E2E/build-pins.sh"
check_build_pin ordpool-electrs "$ELECTRS_SRC" "$ORDPOOL_ELECTRS_SHA"
check_build_pin cat21-ord "$CAT21_ORD_SRC" "$CAT21_ORD_SHA"
check_build_pin ordpool "$ORDPOOL_SRC" "$ORDPOOL_SHA"
# The backend Dockerfile's runtime stage COPYs /build/GeoIP, which nothing in
# the build creates (GeoIP = MaxMind geolocation, unused by /content+/preview).
# Provide an empty dir in the docker/backend build context so the COPY resolves.
mkdir -p "$ORDPOOL_SRC/docker/backend/GeoIP" 2>/dev/null || true

# The compose file names its project `${E2E_PREFIX}-regtest` itself, which is
# the project the slot tears down (`e2e-slots.mjs down`), and every container,
# image and volume carries the slot's prefix, so two slots share nothing.
COMPOSE="docker compose -f $SDK_E2E/docker-compose.regtest.yml --profile ord-stock --profile cat21-ord --profile ordpool-backend"
RPC="docker exec $REGTEST_BITCOIND_CONTAINER bitcoin-cli -regtest -rpcuser=ordpool -rpcpassword=ordpool"
# The bitcoind wallet the SDK's regtest helpers spend from (REGTEST_WALLET,
# their default when unset).
WALLET="${REGTEST_WALLET:-ordpool-e2e}"

# --- bring containers up if not already running ---
# The cube specs verify inscriptions against ord-stock and run the
# funding-safety scan against ord-stock + cat21-ord, so bring both ord
# instances up alongside bitcoind + electrs — the same set the CI workflow
# starts. (In CI the workflow already started them, so this branch is skipped.)
if ! docker ps --format '{{.Names}}' | grep -qx "$REGTEST_BITCOIND_CONTAINER"; then
  $COMPOSE up -d bitcoind electrs ord-stock ord ordpool-backend >&2
fi

# --- wait for bitcoind RPC to respond ---
for _ in $(seq 1 30); do
  if $RPC getblockchaininfo >/dev/null 2>&1; then break; fi
  sleep 1
done
$RPC getblockchaininfo >/dev/null

# --- isolation: never inherit a previous run's chain ---
# The stack above is REUSED when it is already running, so without this a
# second bootstrap inherits everything the first one left: its blocks, its
# wallets, its funded coins and its inscribed fixtures. Observed locally at
# height 1031 with three generations of fixtures on the funder's wallet, which
# is exactly what the funding-safety lanes assert about.
#
# A chain that is not empty when we arrive is carrying state we did not create,
# so it is destroyed and rebuilt. In CI the containers are started fresh by the
# workflow immediately before this runs, so the height is 0 and nothing is torn
# down; the cost lands only where the reuse actually happens.
#
# E2E_REUSE_CHAIN=1 opts out for debugging a chain you want to keep. It is not
# isolated and the specs may see another run's coins.
if [ "$($RPC getblockcount 2>/dev/null || echo 0)" -gt 0 ] && [ "${E2E_REUSE_CHAIN:-0}" != "1" ]; then
  echo "regtest chain is not empty, recreating it for isolation" >&2
  $COMPOSE down -v >&2
  $COMPOSE up -d bitcoind electrs ord-stock ord ordpool-backend >&2
  for _ in $(seq 1 60); do
    if $RPC getblockchaininfo >/dev/null 2>&1; then break; fi
    sleep 1
  done
  $RPC getblockchaininfo >/dev/null
  # bitcoind answering does NOT mean the stack is ready: ord-stock starts on an
  # empty volume and rebuilds its index, and the fixture inscribe that follows
  # budgets 60s for ord to reach a height. Without this the second bootstrap in
  # a row dies on "ord-stock did not reach height N" while ord is still coming
  # up, which reads as a chain problem and is a startup race.
  for _ in $(seq 1 120); do
    if curl -fsS -H 'Accept: application/json' \
      "http://127.0.0.1:${E2E_ORD_STOCK_HOST_PORT}/blockheight" >/dev/null 2>&1; then break; fi
    sleep 1
  done
fi

# --- bitcoind wallet for mining + funding sends ---
# A descriptor wallet (the only kind Bitcoin Core 29+ can create — the
# legacy/BDB backend was removed). It owns the mined coinbases the SDK
# specs spend from; it does NOT hold the funder signing key below.
$RPC -named createwallet wallet_name="$WALLET" load_on_startup=true >/dev/null 2>&1 || \
  $RPC loadwallet "$WALLET" >/dev/null 2>&1 || true

MINING_ADDR=$($RPC -rpcwallet="$WALLET" getnewaddress)

# --- funder keypair the SDK specs sign with ---
# Supplied as a fixed regtest keypair instead of dumped from bitcoind:
# descriptor wallets can't export a WIF and legacy wallets are gone on
# Core 29+. The specs derive the funder pubkey from this WIF and fund
# pubkey-derived addresses from the wallet's coinbases, then sign with
# the WIF. Throwaway regtest-only key (deterministic, zero real value).
ADDR="bcrt1qw5pw5evmamu6dm5qze7a8yg07wmamvzpq3huc3"
WIF="cNvr6PMcpe862cZuaxP4kqMDodEUxLXSW7DGxW6c7PiYTZ5sWQcK"

# --- mine 101 blocks to mature the coinbase ---
TIP=$($RPC getblockcount)
if [ "$TIP" -lt 101 ]; then
  NEEDED=$((101 - TIP))
  $RPC -rpcwallet="$WALLET" generatetoaddress "$NEEDED" "$MINING_ADDR" >/dev/null
fi

# --- wait for electrs to catch up to bitcoind's tip ---
TIP=$($RPC getblockcount)
for _ in $(seq 1 30); do
  if [ "$(curl -s "http://127.0.0.1:${E2E_ELECTRS_HOST_PORT}/blocks/tip/height" || echo 0)" -ge "$TIP" ]; then break; fi
  sleep 1
done

# --- wait for ordpool-backend to accept connections (mempool witness renderer) ---
# `curl -s` (no -f) exits 0 as soon as the server responds with any status,
# so this waits for the port to be live regardless of the route's code.
for _ in $(seq 1 90); do
  if curl -s -o /dev/null "http://127.0.0.1:${E2E_ORDPOOL_BACKEND_HOST_PORT}/api/v1/backend-info" 2>/dev/null; then break; fi
  sleep 2
done

# --- inscribe the fixtures this chain has to serve ---
# The app asks ord for the cube renderer and every unfilled side by inscription
# id. Those ids are part of the minted bytes and of the preview, so they have to
# exist HERE: a mainnet id on regtest is a request the stack cannot answer.
# Writes src/environments/regtest-inscriptions.generated.ts, which the regtest
# environment and the spec helpers both read.
"$HERE/inscribe-fixtures.sh" >&2

# --- the cubes index of this chain ----------------------------------------
# The regtest build reads its gallery from the index build-cubes-index.sh
# writes, so it has to exist before the app starts: empty on a fresh chain,
# listing whatever a lane mints once that lane re-runs the script.
"$HERE/build-cubes-index.sh" >&2

# --- emit the credentials and the slot as JSON ---
BALANCE=$($RPC -rpcwallet="$WALLET" getbalance)
SLOT_ENV_JSON="$(node "$STACK_SLOTS_CLI" env --slot "$E2E_SLOT" --kind regtest --format json)"
jq -n \
  --arg address "$ADDR" \
  --arg wif "$WIF" \
  --arg balance "$BALANCE" \
  --arg tipHeight "$TIP" \
  --argjson slot "$E2E_SLOT" \
  --arg prefix "$E2E_PREFIX" \
  --argjson env "$SLOT_ENV_JSON" \
  '{ address: $address, wif: $wif, balance: $balance, tipHeight: $tipHeight, slot: $slot, prefix: $prefix, env: $env }'

if [ "$STACK_SLOT_ACQUIRED_HERE" = 1 ]; then
  echo "regtest-bootstrap: the stack holds slot $E2E_SLOT ($E2E_PREFIX) until it is torn down." >&2
  echo "  its environment, for the specs: eval \"\$(node $STACK_SLOTS_CLI env --slot $E2E_SLOT --kind regtest)\"" >&2
  echo "  tear it down:                   node $STACK_SLOTS_CLI down $E2E_SLOT" >&2
fi
