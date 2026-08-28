import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { bridgeSignedPsbt } from './watch-only-sign-bridge';

/**
 * Pins the watch-only export/paste resolution: the value the export modal
 * resolves with is exactly what the SDK's promptForSignedPsbt receives
 * (trimmed), and a dismissed modal becomes a clean cancel error.
 */
describe('bridgeSignedPsbt', () => {
  it('resolves with the pasted signed PSBT, trimmed', async () => {
    const pasted = '  cHNidP8BAHECAAAAAA==  ';
    const emitted = await firstValueFrom(bridgeSignedPsbt(Promise.resolve(pasted)));
    expect(emitted).toBe('cHNidP8BAHECAAAAAA==');
  });

  it('passes a hex-encoded signed PSBT through unchanged', async () => {
    const emitted = await firstValueFrom(bridgeSignedPsbt(Promise.resolve('70736274ff01')));
    expect(emitted).toBe('70736274ff01');
  });

  it('maps a dismissed modal to a clean cancel error', async () => {
    await expect(firstValueFrom(bridgeSignedPsbt(Promise.reject('backdrop-click'))))
      .rejects.toThrow('Watch-only signing was cancelled.');
  });
});
