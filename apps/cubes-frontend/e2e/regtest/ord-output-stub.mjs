#!/usr/bin/env node
/**
 * Clean-`/output` stub for the regtest e2e content scan.
 *
 * The SDK's funding-safety layer (`UtxoContentScanner` /
 * `FundingRecommendationService`) force-scans every covering funding
 * candidate for content before the orchestrator may auto-pick it:
 * `GET ${ordApiUrl}/output/<outpoint>` + `GET ${cat21OrdApiUrl}/output/<outpoint>`.
 * A coin classifies `clean` (safe to auto-spend as funding) only when both
 * responses carry no inscription, rune, cat, or rare sat.
 *
 * In regtest both those URLs point here (`environment.regtest.ts`). This stub
 * answers every outpoint with an empty-asset body, so a fresh regtest funding
 * coin always classifies `clean` and the mint flow's auto-pick proceeds. That
 * decouples the scan gate from regtest sat provenance: a coinbase-derived coin
 * can carry an "uncommon" block-first-sat that a real `--index-sats` ord would
 * flag as a rare sat, which would (correctly, in prod) drop the coin to
 * expert-mode. The cube-mint round-trip isn't testing asset detection; the real
 * cube inscription is still verified byte-for-byte against the actual ord-stock
 * (:8081). Same approach cat21-indexer uses for its mint regtest.
 *
 * Not a fail-open: this is a test double that returns a KNOWN-clean body for a
 * KNOWN-plain funding coin. Production keeps the real ord instances, which fail
 * CLOSED (an unreachable ord -> scan-failed -> expert-mode), never auto-clean.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.ORD_STUB_PORT ?? 8082);

// Merged shape covering both OrdOutputResponse (inscriptions/runes/sat_ranges)
// and Cat21OrdOutputResponse (cats/sat_ranges). Both scanner fetches hit this
// same stub; each reads only its own fields, the extras are ignored.
const CLEAN_BODY = JSON.stringify({
  inscriptions: [],
  runes: null,
  sat_ranges: [],
  cats: [],
});

const server = createServer((req, res) => {
  // The scan is a cross-origin fetch from the dev server (:4203). `Accept:
  // application/json` is CORS-safelisted, so no preflight fires, but the
  // response still needs ACAO for the browser to expose it.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const path = (req.url ?? '').split('?')[0];
  if (path.startsWith('/output/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(CLEAN_BODY);
    return;
  }

  // Any other path (readiness probes, /status): a bare 200 keeps Playwright's
  // webServer happy and answers anything the scan doesn't query.
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end('{}');
});

server.listen(PORT, () => {
  console.log(`[ord-output-stub] clean /output stub listening on :${PORT}`);
});
