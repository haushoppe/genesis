import { Component, input } from '@angular/core';
import { ExpertRequiredCause } from 'ordpool-sdk';

import { bucketLabel } from './funding-bucket-label';

/**
 * The warning over a blocked mint (`expert-required`), worded by WHY it is
 * blocked. The cause is the SDK's `expertRequiredCause`, the same fact an
 * agent's error message is built from, so a person and an agent are told the
 * same thing (HQ CLAUDE.md, "An agent gets the same answer and the same facts
 * as a person").
 *
 * - `named-assets`: the covering coins carry assets the scan named, on a wallet
 *   that keeps ordinals and spending money on one address. The picker row lists
 *   them under its "asset found" badge.
 * - `unnamed-assets`: the scan says a coin carries something and cannot say
 *   what, so there is no list to point at.
 * - `unknown-content`: the scan failed, nothing is known about the coin, and
 *   the row's "Retry scan" asks again.
 *
 * Each badge is rendered with the picker's own label and colours, so the
 * warning points at exactly what the reader sees in the rows below it.
 */
@Component({
  selector: 'app-funding-expert-required',
  template: `
    <div class="alert alert-warning py-2 px-3 small" role="alert"
         data-testid="mint-expert-required" [attr.data-cause]="cause()">
      @switch (cause()) {
        @case ('named-assets') {
          Every coin that can fund this mint carries an inscription, rune, cat or
          rare sat, and this wallet keeps those on the same address as its spending
          money, so no coin is picked for you. Choose one below. A coin marked
          <span class="badge bg-danger-subtle text-danger-emphasis">{{ assetsLabel }}</span>
          lists what it carries, and picking it spends those along with the coin.
        }
        @case ('unnamed-assets') {
          The scan reports assets on every coin that can fund this mint but cannot
          say which, so no coin is picked for you. Choose one below. A coin marked
          <span class="badge bg-danger-subtle text-danger-emphasis">{{ assetsLabel }}</span>
          carries something even where nothing is listed, and picking it spends that
          along with the coin.
        }
        @case ('unknown-content') {
          What the coins that can fund this mint carry could not be checked, so no
          coin is picked for you. A coin marked
          <span class="badge bg-warning-subtle text-warning-emphasis">{{ failedLabel }}</span>
          may carry an inscription, rune, cat or rare sat. Press Retry scan on it to
          check again, or choose a coin below.
        }
      }
    </div>
  `,
})
export class FundingExpertRequired {
  readonly cause = input.required<ExpertRequiredCause>();

  protected readonly assetsLabel = bucketLabel('assets');
  protected readonly failedLabel = bucketLabel('failed');
}
