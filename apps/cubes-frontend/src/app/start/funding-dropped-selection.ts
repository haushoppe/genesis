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
      @switch (dropped().reason) {
        @case ('gone') {
          is no longer available. Pick another coin below.
        }
        @case ('below-requirement') {
          no longer covers this mint at this fee rate. Lower the fee rate or pick another coin below.
        }
      }
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
}
