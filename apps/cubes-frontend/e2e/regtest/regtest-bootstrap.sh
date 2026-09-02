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

COMPOSE="docker compose -f $HERE/../../node_modules/ordpool-sdk/e2e/docker-compose.regtest.yml"
RPC="docker exec ${E2E_PREFIX}-bitcoind bitcoin-cli -regtest -rpcuser=ordpool -rpcpassword=ordpool"

# --- bring containers up if not already running ---
# The cube specs verify inscriptions against ord-stock (:8081), so bring it
# up alongside bitcoind + electrs — the same set the CI workflow starts. (In
# CI the workflow already started them, so this branch is skipped.)
if ! docker ps --format '{{.Names}}' | grep -q "${E2E_PREFIX}-bitcoind"; then
  $COMPOSE --profile ord-stock up -d bitcoind electrs ord-stock >&2
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
  if [ "$(curl -s http://localhost:3000/blocks/tip/height || echo 0)" -ge "$TIP" ]; then break; fi
  sleep 1
done

# --- emit the credentials as JSON ---
BALANCE=$($RPC -rpcwallet=cubes-e2e getbalance)
jq -n \
  --arg address "$ADDR" \
  --arg wif "$WIF" \
  --arg balance "$BALANCE" \
  --arg tipHeight "$TIP" \
  '{ address: $address, wif: $wif, balance: $balance, tipHeight: $tipHeight }'
