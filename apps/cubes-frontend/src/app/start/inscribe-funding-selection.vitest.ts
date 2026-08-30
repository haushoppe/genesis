import { describe, expect, it } from 'vitest';
import {
  getDummyKeypair, InscribeMintOrchestrator, InscribeSnapshot,
  KnownOrdinalWalletType, Network, toScureNetwork, TxnOutput,
} from 'ordpool-sdk';
import { hex } from '@scure/base';

/**
 * Cubes-side durable coverage of the change-headroom fix on the INSCRIBE path.
 *
 * The dust-cliff over-pay bug: in a wallet pool holding a tight coin (covers
 * the no-change funding requirement but leaves sub-dust change → absorbed into
 * the fee → realised rate 7-13% over typed) AND a larger headroom coin, the
 * pre-fix `selectFunding` best-fit picked the tight coin. The SDK fix biases
 * the auto-pick toward a coin that leaves above-dust change (`preferredTarget`).
 *
 * Cubes reaches selectFunding through `InscribeMintOrchestrator`, whose inscribe
 * `preferredTarget = target + changeDustFloor(paymentAddress)` (fd69ee5, was a
 * hardcoded 546 that over-shot the segwit/taproot dust floor and could exclude a
 * valid headroom coin). This pins that the orchestrator's mixed-pool auto-pick
 * takes the HEADROOM coin, not the dust-cliff coin — the inscribe-path
 * equivalent of the SDK's mint mixed-pool proof.
 */
describe('inscribe funding selection: mixed pool auto-picks the headroom coin', () => {
  const dummy = getDummyKeypair(toScureNetwork(Network.Regtest));
  // Segwit payment address (dust floor 294 < the old hardcoded 546) — the exact
  // case where the pre-fix +546 could wrongly exclude a valid headroom coin.
  const wallet = {
    type: KnownOrdinalWalletType.xpub,
    ordinalsAddress: dummy.addressP2TR,
    paymentAddress: dummy.addressP2WPKH,
    paymentPublicKey: hex.encode(dummy.dummyPublicKey),
  };
  const content = {
    body: new TextEncoder().encode('<html><!--cubes.haushoppe.art--><body>cube</body></html>'),
    contentType: 'text/html;charset=utf-8',
  };

  function coin(txid: string, value: number): TxnOutput {
    return { txid: txid.repeat(64).slice(0, 64), vout: 0, value, status: { confirmed: true } };
  }

  async function snapshotFor(utxos: TxnOutput[], feeRate: number): Promise<InscribeSnapshot> {
    const orch = new InscribeMintOrchestrator({
      getUtxos: async () => utxos,
      scan: { classify: async () => 'clean' }, // both coins clean → no expert-mode
      broadcast: async () => 'txid',
      network: Network.Regtest,
    });
    // setWallet FIRST: on a genuine wallet change it resets feeRate/content, so
    // the setters must follow it. Then wait for the content-driven recompute
    // (fire-and-forget inside setContent) to populate the funding simulations.
    await orch.setWallet(wallet); // fetches utxos, state -> ready
    orch.setFeeRate(feeRate);
    return new Promise<InscribeSnapshot>((resolve) => {
      const unsub = orch.subscribe((s) => {
        if (s.simulations.length > 0 || s.state === 'error') {
          unsub();
          resolve(s);
        }
      });
      orch.setContent(content); // triggers the recompute that fills simulations
    });
  }

  it('prefers a large headroom coin over a tight dust-cliff coin at a high fee rate', async () => {
    const feeRate = 100; // high rate → the dust-cliff over-pay is material (7-13%)

    // 1. Learn the funding requirement R from a single generous coin.
    const probe = await snapshotFor([coin('a', 10_000_000)], feeRate);
    const R = probe.simulations[0]?.simulation?.fundingRequirementSats ?? 0;
    expect(R).toBeGreaterThan(0);

    // 2. Mixed pool: a tight coin ~200 sat over R (leaves sub-dust change → the
    //    coin best-fit would grab) + a large headroom coin.
    const dustCliff = coin('b', R + 200);
    const headroom = coin('c', R + 500_000);
    const snap = await snapshotFor([dustCliff, headroom], feeRate);

    // Both clean + covering → a clean coin covers → auto (no expert-mode).
    expect(snap.fundingRecommendation.status).toBe('auto');
    // The fix: auto-pick the headroom coin, NOT the tight dust-cliff coin.
    expect(snap.fundingRecommendation.recommended?.txid).toBe(headroom.txid);
    expect(snap.fundingRecommendation.recommended?.value).toBe(R + 500_000);
  });
});
