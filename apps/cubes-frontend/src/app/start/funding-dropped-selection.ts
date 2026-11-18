import { Component, input } from '@angular/core';
import { DroppedSelection, TxnOutput } from 'ordpool-sdk';

/**
 * The notice over the funding coin when the coin the reader PICKED is not the
 * coin that will be spent. The fact and its reason are the SDK's
 * (`droppedSelection` on the orchestrator snapshot, from `describeFundingPick`),
 * the same fact an agent reads, so the page never compares outpoints itself.
 *
 * - `gone`: the coin left the wallet's spendable set, so the only remedy is
 *   another coin.
 * - `below-requirement`: the coin is still there and no longer covers the mint
 *   at the current fee rate, so a lower rate brings it back.
 * - `contents-changed`: the coin is still there and covers, but a later scan
 *   finds something on it that was not shown when it was picked, so the pick
 *   no longer stands for what the reader agreed to.
 *
 * The wording is a `Record` over the SDK's reason type, so a reason the SDK
 * adds is a compile error here rather than a sentence with a hole in it: a
 * template `@switch` without that case renders the coin and then nothing.
 *
 * `replacement` is the coin the SDK resolved instead (`resolvedFundingUtxo`),
 * or null when it resolved none (`expert-required`, or nothing covers). Naming
 * it, or saying there is none, keeps the reader from assuming the mint still
 * spends the coin they chose.
 */
@Component({
  selector: 'app-funding-dropped-selection',
  template: `
    <div class="alert alert-warning py-2 px-3 small" role="alert"
         data-testid="mint-dropped-selection" [attr.data-reason]="dropped().reason">
      The funding coin you picked,
      <code data-testid="mint-dropped-selection-coin">{{ dropped().txid.slice(0, 12) }}…:{{ dropped().vout }}</code>,
      <span data-testid="mint-dropped-selection-reason">{{ reasonText[dropped().reason] ?? fallbackReason }}</span>
      @if (replacement(); as coin) {
        For now this mint is funded by
        <code data-testid="mint-dropped-selection-replacement">{{ coin.txid.slice(0, 12) }}…:{{ coin.vout }}</code>.
      } @else {
        No other coin is picked for you.
      }
    </div>
  `,
})
export class FundingDroppedSelection {
  readonly dropped = input.required<DroppedSelection>();
  readonly replacement = input.required<TxnOutput | null>();

  /**
   * For a reason this build does not know, which the type rules out and only a
   * version skew between this app and the SDK at runtime could produce. Says
   * the one thing every reason means, so the sentence is never cut off.
   */
  protected readonly fallbackReason = 'is no longer the coin this mint spends. Pick a coin below.';

  protected readonly reasonText: Record<DroppedSelection['reason'], string> = {
    'gone': 'is no longer available. Pick another coin below.',
    'below-requirement': 'no longer covers this mint at this fee rate. Lower the fee rate or pick another coin below.',
    'contents-changed': 'now carries something that was not shown when you picked it. Check what it carries below, or pick another coin.',
  };
}
