#!/usr/bin/env bash
# Inscribe the committed fixture bytes onto the regtest chain and write their
# ids to src/environments/regtest-inscriptions.generated.ts.
#
# The app requests `/content/<id>` for the cube renderer and for every unfilled
# side. Those ids are part of the minted bytes and of the preview, so on regtest
# they have to exist on THIS chain: a mainnet id there is a request the stack
# cannot answer, which is what the deleted console-error allowlist was hiding.
#
# Ids are not stable across bootstraps (they depend on the funding txids), so
# the generated file is gitignored and rewritten on every run.
#
# Usage:  ./e2e/regtest/inscribe-fixtures.sh
# Reads:  E2E_PREFIX (default cubes-e2e), E2E_ORD_STOCK_HOST_PORT (default 8081)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$(cd "$HERE/../.." && pwd)"
PREFIX="${E2E_PREFIX:-cubes-e2e}"
ORD_PORT="${E2E_ORD_STOCK_HOST_PORT:-8081}"
OUT="$APP/src/environments/regtest-inscriptions.generated.ts"

BTC() { docker exec "${PREFIX}-bitcoind" bitcoin-cli -regtest -rpcuser=ordpool -rpcpassword=ordpool "$@"; }
# `--no-backup` is load-bearing: ord's recovery-key import (`importdescriptors`
# of the commit key) fails against Bitcoin Core v30 with "commit tx recovery key
# import failed", and the backup is worthless for a throwaway regtest chain.
ORD() {
  docker exec "${PREFIX}-ord-stock" ord --regtest \
    --bitcoin-rpc-url=bitcoind:18443 --bitcoin-rpc-username=ordpool --bitcoin-rpc-password=ordpool \
    --data-dir=/data wallet --server-url http://127.0.0.1:8080 "$@"
}

# ord refuses every wallet command while its index trails bitcoind, so each
# mine is followed by a wait rather than a sleep.
wait_for_ord_sync() {
  local want; want="$(BTC getblockcount)"
  for _ in $(seq 1 60); do
    if [ "$(curl -fsS -H 'Accept: application/json' "http://127.0.0.1:${ORD_PORT}/blockheight" 2>/dev/null || echo -1)" = "$want" ]; then return 0; fi
    sleep 1
  done
  echo "ord-stock did not reach height $want" >&2; exit 1
}

# ord answers /content only once its index has caught up, so the liveness
# probe below has to run AFTER the wait, not before it. Probing a trailing ord
# returns a non-200 for ids that are perfectly alive, the script concludes the
# chain is fresh, and it re-inscribes every fixture and rewrites $OUT. Under a
# running dev server that swaps the ids the app is already serving.
#
# This is also before the first wallet command, which ord refuses outright
# while its index trails bitcoind.
wait_for_ord_sync

# --- already inscribed on THIS chain? ------------------------------------
# The lane calls this on every run, so re-inscribing eight fixtures per spec
# file would be pure waste. Idempotence is decided by the CHAIN, not by the
# file existing: after a `down -v` the ids in it are dead and every one 404s,
# which is exactly the state that produced a red lane with a green bootstrap.
if [ -f "$OUT" ]; then
  alive=1
  for id in $(grep -oE "'[0-9a-f]{64}i[0-9]+'" "$OUT" | tr -d "'"); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${ORD_PORT}/content/$id")" = "200" ] || { alive=0; break; }
  done
  if [ "$alive" = "1" ]; then
    echo "fixtures already inscribed on this chain, keeping $OUT" >&2
    exit 0
  fi
fi

# Run an ord wallet command whose stdout is JSON, and fail loudly with ord's
# own message.
#
# stderr is captured SEPARATELY rather than folded in with `2>&1`. ord writes
# warnings there on the very commands whose stdout is parsed: `ord wallet
# balance` prints "warning: output <op> contains both inscriptions and runes"
# (balance.rs) while still exiting 0, and folded into stdout that sentence
# reaches python3 as leading garbage and the run dies on a JSON decode error
# naming neither ord nor the output it was warning about.
ord_json() {
  local out err
  err="$(mktemp)"
  if ! out="$("$@" 2>"$err")"; then
    echo "$* failed: $(cat "$err")" >&2
    rm -f "$err"
    exit 1
  fi
  # A warning on a successful command is still worth seeing; it just must not
  # end up in the JSON. An `if` rather than `[ ... ] && cat`, because under
  # `set -e` that list exits the script whenever the test is false, which is
  # every ordinary call.
  if [ -s "$err" ]; then cat "$err" >&2; fi
  rm -f "$err"
  printf '%s' "$out"
}

# --- an ord wallet with mature funds -------------------------------------
# The sync wait that has to precede the first wallet command already ran above,
# before the liveness probe.
#
# The probe's stderr is kept and printed when it fails. Discarding it with
# `2>&1` hides ord's own sentence ("`ord server` N blocks behind `bitcoind`")
# and leaves the next command to die on empty stdin, so the run reports a JSON
# decode error instead of the cause.
if ! ORD_PROBE="$(ORD balance 2>&1)"; then
  echo "ord wallet not usable yet, creating it. ord said: $ORD_PROBE" >&2
  ORD create >/dev/null
fi
if [ "$(ord_json ORD balance | python3 -c 'import sys,json;print(json.load(sys.stdin)["cardinal"])')" -lt 10000000 ]; then
  ADDR="$(ord_json ORD receive | python3 -c 'import sys,json;print(json.load(sys.stdin)["addresses"][0])')"
  BTC -rpcwallet="${PREFIX}" sendtoaddress "$ADDR" 1 >/dev/null
  BTC -rpcwallet="${PREFIX}" -generate 1 >/dev/null
  wait_for_ord_sync
fi

# --- inscribe every fixture ----------------------------------------------
docker exec "${PREFIX}-ord-stock" rm -rf /fixtures
docker cp "$HERE/fixtures" "${PREFIX}-ord-stock:/fixtures" >/dev/null

# ord only spends CONFIRMED cardinal utxos, so every inscription's change has
# to be mined before the next one can be funded from it. Without the mine the
# second inscribe fails with "wallet contains no cardinal utxos" while the
# change sits unconfirmed in bitcoind.
inscribe() {
  local id
  id="$(ord_json ORD inscribe --fee-rate 1 --no-backup --file "/fixtures/$1" \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["inscriptions"][0]["id"])')"
  BTC -rpcwallet="${PREFIX}" -generate 1 >/dev/null
  wait_for_ord_sync
  echo "$id"
}

# The v3 renderer is gzip-packed and inflates itself with fflate, which it
# fetches from a SECOND inscription whose mainnet id is hardcoded in its own
# bytes (line 28 of that document is fflate, line 32 is d3). Nothing on this
# chain answers that id, so the renderer dies with "fflate is not defined" and
# no cube paints. Inscribe the dependency bundle first, then substitute ITS
# regtest id into the renderer's bytes before inscribing the renderer.
#
# The inscribed renderer is therefore the mainnet v3 renderer with one
# inscription id replaced, not byte-identical to mainnet. Nothing depends on
# that identity: the byte-for-byte assertion compares the app's output to the
# app's own generator, both of which use the id this script writes.
MAINNET_DEPS_ID='2dbdf9ebbec6be793fd16ae9b797c7cf968ab2427166aaf390b90b71778266abi0'
DEPS="$(inscribe renderer-deps.html)"

RENDERER_SRC="$HERE/fixtures/cube-renderer.js"
grep -q "$MAINNET_DEPS_ID" "$RENDERER_SRC" || {
  echo "cube-renderer.js no longer references $MAINNET_DEPS_ID; the substitution below is stale" >&2
  exit 1
}
docker exec "${PREFIX}-ord-stock" sh -c \
  "sed 's|$MAINNET_DEPS_ID|$DEPS|g' /fixtures/cube-renderer.js > /fixtures/cube-renderer.regtest.js"
RENDERER="$(inscribe cube-renderer.regtest.js)"
SIDES=()
for n in 1 2 3 4 5 6; do SIDES+=("$(inscribe "side-$n.png")"); done
NON_IMAGE="$(inscribe non-image.json)"

# --- write the generated module ------------------------------------------
{
  echo "// GENERATED by e2e/regtest/inscribe-fixtures.sh. Do not edit, do not commit."
  echo "// Regtest inscription ids depend on the funding txids, so they change with"
  echo "// every fresh chain. The bytes behind them are the committed fixtures in"
  echo "// e2e/regtest/fixtures/. All are byte-identical to their mainnet originals"
  echo "// except cubeRenderer, which carries rendererDeps in place of the mainnet"
  echo "// dependency id hardcoded in its own bytes."
  echo "export const regtestInscriptions = {"
  echo "  cubeRenderer: '$RENDERER',
  rendererDeps: '$DEPS',"
  echo "  fallbackSides: ["
  for id in "${SIDES[@]}"; do echo "    '$id',"; done
  echo "  ],"
  echo "  nonImageSide: '$NON_IMAGE',"
  echo "};"
} > "$OUT"

echo "wrote $OUT" >&2
cat "$OUT" >&2
