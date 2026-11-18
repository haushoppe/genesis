/**
 * @test-kind unit
 * Real:   the two shipped mainnet environments
 * Faked:  nothing
 * Proves: every host a cube's own subresources come from is one we run
 *
 * A cube iframe's document carries `<base href>` pointing at its preview
 * base's root, so that host serves the renderer script and all six faces. A
 * third party there is unfixable from inside the page: a subresource request
 * answered with an interactive challenge cannot be passed by one, nobody is
 * there to click it, and the cube stays a dark rectangle.
 *
 * The regtest environment is deliberately NOT asserted here: its hosts are
 * the local stack's ports.
 */
import { environment } from '../environments/environment';
import { environment as prodEnvironment } from '../environments/environment.prod';

/** A host we run. The scheme and the trailing path are checked separately. */
const OURS = /^https:\/\/[a-z0-9.-]*\bordpool\.space\//;

describe('the hosts a cube renders from', () => {
  for (const [name, env] of [['dev', environment], ['prod', prodEnvironment]] as const) {
    describe(name, () => {
      it('serves every on-chain cube from a host we run', () => {
        expect(env.ordinalsExplorerIframe).toMatch(OURS);
        expect(env.ownPreviewIframe).toMatch(OURS);
      });

      // The directive derives the cube's bytes from the sibling `/content/` of
      // this base and the document's `<base href>` from its root, so a base
      // that does not end in `/preview/` silently addresses neither.
      it('ends both preview bases with /preview/', () => {
        expect(env.ordinalsExplorerIframe).toMatch(/\/preview\/$/);
        expect(env.ownPreviewIframe).toMatch(/\/preview\/$/);
      });

      // The mint form probes each side as an <img> before enabling Mint, and
      // the SDK's content scan reads two ord instances per funding coin. The
      // same argument applies: a third party answering 403 there blocks a
      // mint rather than a picture.
      it('probes sides and scans funding coins against hosts we run', () => {
        expect(env.sideImageProbeBase + '/').toMatch(OURS);
        expect(env.ordApiUrl + '/').toMatch(OURS);
        expect(env.mempoolApiUrl + '/').toMatch(OURS);
      });
    });
  }
});
