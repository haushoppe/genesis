#!/usr/bin/env bash
# Bring up bitcoind + electrs (regtest) and mine 101 blocks so the
# coinbase rewards mature. Prints a regtest funder keypair (address +
# WIF) on stdout (as JSON) so the E2E suite can pick them up.
#
# Usage:
#   ./e2e/regtest-bootstrap.sh
#   eval $(./e2e/regtest-bootstrap.sh | jq -r '"export REGTEST_FUNDED_ADDR=" + .address + " REGTEST_FUNDED_WIF=" + .wif')

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"

# The regtest stack is the SDK's shipped compose (single source of truth;
# this repo no longer keeps a copy). Parametrize it for the cubes stack:
# E2E_PREFIX keeps the container names this script + the specs expect
# (cubes-e2e-*); ELECTRS_SRC / CAT21_ORD_SRC point the build contexts at
# the fork checkouts. CI sets all three itself; for a standalone local run
# they default to the workspace-sibling checkouts under /Work/ordpool/.
export E2E_PREFIX="${E2E_PREFIX:-cubes-e2e}"
export ELECTRS_SRC="${ELECTRS_SRC:-$(cd "$HERE/../../../../.." && pwd)/ordpool-electrs}"
export CAT21_ORD_SRC="${CAT21_ORD_SRC:-$(cd "$HERE/../../../../.." && pwd)/cat21-ord}"
# The mempool-witness renderer (real ordpool-backend) that serves the
# just-minted cube from the mempool before confirmation. Build context is
# the ordpool checkout (backend/ + rust/); CI sets ORDPOOL_SRC itself.
export ORDPOOL_SRC="${ORDPOOL_SRC:-$(cd "$HERE/../../../../.." && pwd)/ordpool}"
# The backend Dockerfile's runtime stage COPYs /build/GeoIP, which nothing in
# the build creates (GeoIP = MaxMind geolocation, unused by /content+/preview).
# Provide an empty dir in the docker/backend build context so the COPY resolves.
mkdir -p "$ORDPOOL_SRC/docker/backend/GeoIP" 2>/dev/null || true

# `-p` is load-bearing, not cosmetic. The compose file sets no project name, so
# the project defaults to the directory it lives in, which is `e2e` for EVERY
# consumer of the SDK's stack. Two repos bringing it up on one daemon then share
# a project: compose treats the other's running containers as its own services
# and will recreate or remove them, and the named volumes resolve to the same
# `e2e_*` for both, so even a differently-prefixed stack shares its index.
# E2E_PREFIX does not help; it only renames containers. Measured the hard way on
# 2026-09-14, when another session's isolated-looking stack deleted this one's
# chain. Pinning the project makes the isolation real.
COMPOSE="docker compose -p cubes-e2e -f $HERE/../../node_modules/ordpool-sdk/e2e/docker-compose.regtest.yml"
RPC="docker exec ${E2E_PREFIX}-bitcoind bitcoin-cli -regtest -rpcuser=ordpool -rpcpassword=ordpool"

# --- bring containers up if not already running ---
# The cube specs verify inscriptions against ord-stock (:8081) and run the
# funding-safety scan against ord-stock + cat21-ord (:8080), so bring both ord
# instances up alongside bitcoind + electrs — the same set the CI workflow
# starts. (In CI the workflow already started them, so this branch is skipped.)
if ! docker ps --format '{{.Names}}' | grep -q "${E2E_PREFIX}-bitcoind"; then
  $COMPOSE --profile ord-stock --profile cat21-ord --profile ordpool-backend \
    up -d bitcoind electrs ord-stock ord ordpool-backend >&2
fi

# --- wait for bitcoind RPC to respond ---
for _ in $(seq 1 30); do
  if $RPC getblockchaininfo >/dev/null 2>&1; then break; fi
  sleep 1
done
$RPC getblockchaininfo >/dev/null

# --- bitcoind wallet for mining + funding sends ---
# A descriptor wallet (the only kind Bitcoin Core 29+ can create — the
# legacy/BDB backend was removed). It owns the mined coinbases the SDK
# specs spend from; it does NOT hold the funder signing key below.
$RPC -named createwallet wallet_name=cubes-e2e load_on_startup=true >/dev/null 2>&1 || \
  $RPC loadwallet cubes-e2e >/dev/null 2>&1 || true

MINING_ADDR=$($RPC -rpcwallet=cubes-e2e getnewaddress)

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
  $RPC -rpcwallet=cubes-e2e generatetoaddress "$NEEDED" "$MINING_ADDR" >/dev/null
fi

# --- wait for electrs to catch up to bitcoind's tip ---
TIP=$($RPC getblockcount)
for _ in $(seq 1 30); do
  if [ "$(curl -s http://localhost:3010/blocks/tip/height || echo 0)" -ge "$TIP" ]; then break; fi
  sleep 1
done

# --- wait for ordpool-backend to accept connections (mempool witness renderer) ---
# `curl -s` (no -f) exits 0 as soon as the server responds with any status,
# so this waits for the port to be live regardless of the route's code.
for _ in $(seq 1 90); do
  if curl -s -o /dev/null "http://localhost:8999/api/v1/backend-info" 2>/dev/null; then break; fi
  sleep 2
done

# --- inscribe the fixtures this chain has to serve ---
# The app asks ord for the cube renderer and every unfilled side by inscription
# id. Those ids are part of the minted bytes and of the preview, so they have to
# exist HERE: a mainnet id on regtest is a request the stack cannot answer.
# Writes src/environments/regtest-inscriptions.generated.ts, which the regtest
# environment and the spec helpers both read.
"$HERE/inscribe-fixtures.sh" >&2

# --- emit the credentials as JSON ---
BALANCE=$($RPC -rpcwallet=cubes-e2e getbalance)
jq -n \
  --arg address "$ADDR" \
  --arg wif "$WIF" \
  --arg balance "$BALANCE" \
  --arg tipHeight "$TIP" \
  '{ address: $address, wif: $wif, balance: $balance, tipHeight: $tipHeight }'
