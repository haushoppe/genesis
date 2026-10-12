import { UtxoScanBucket } from 'ordpool-sdk';

/**
 * The five scan-bucket labels are the family's, shared verbatim with
 * ordpool.space and cat21.space so a funding coin reads the same wherever it
 * is shown (FAMILY_UX.md, "Every site scans a funding coin and says what it
 * found"). The coin picker's badges and the warning that points at them read
 * the same function, so the warning names the badge the reader actually sees.
 */
export function bucketLabel(bucket: UtxoScanBucket): string {
  switch (bucket) {
    case 'clean': return '✓ safe';
    case 'assets': return '⚠ asset found';
    case 'unscanned': return 'not scanned';
    case 'scanning': return 'scanning…';
    case 'failed': return 'scan failed';
  }
}
