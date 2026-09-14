import { parseCube } from '../../shared/ordinals/parse-cube';
import { isValidInscriptionId } from './is-valid-inscription-id';
import { removeTrailingPipes } from './mint-service-remove-trailing-pipes';

/** The six inscriptions displayed on the six cube faces. */
export interface SixInscriptionIds {
  inscriptionId1: string;
  inscriptionId2: string;
  inscriptionId3: string;
  inscriptionId4: string;
  inscriptionId5: string;
  inscriptionId6: string;
}

/** Everything the mint form collects before it hands the HTML to the SDK. */
export interface CubeDetails {
  inscriptionIds: SixInscriptionIds;
  title: string;
  rotationSpeedX: string;
  rotationSpeedY: string;
  colorPane: string;
  bgColor1: string;
  bgColor2: string;
}

/**
 * Cube HTML shape ord renders when it fetches the inscription's body.
 * The first script tag sets `t` = pipe-delimited string of the six
 * inscription IDs + rotation speeds + colour data; the second pulls
 * the cube renderer inscription from ord's recursive `/content/`
 * endpoint. Two comment markers identify the cube protocol.
 */
const TEMPLATE_HEAD_NO_TITLE = `<html><!--cubes.haushoppe.art--><body><script>t='`;
const TEMPLATE_HEAD_WITH_TITLE = `<html><!--cubes.haushoppe.art--><head><title>__TITLE__</title></head><body><script>t='`;

/** ID of the cube renderer inscription — its /content is loaded by every cube. */
const CUBE_RENDERER_INSCRIPTION_ID = 'fed0eb2d943b1b6ce83c1d7bfb4639d3d44c7fdb161b1037c2fadaf630e55a55i0';
const TEMPLATE_TAIL = `'</script><script src=/content/${CUBE_RENDERER_INSCRIPTION_ID}></script>`;

/**
 * Preview-only fallback faces — the digits 1-6 shown on a cube side the
 * user hasn't filled yet. These are real on-chain inscriptions (the
 * BitcoinOneZero collection, plain white digit on black, image/png), so a
 * placeholder side loads through `/content/<id>` exactly like any real
 * face: nothing app-hosted, no CORS header or base-href special-casing.
 *
 * They ARE valid inscription IDs, so they intentionally do not gate
 * minting. The mint gate is the form validator: every side field is
 * `required`, so a cube with any unfilled side cannot be minted
 * (`canMint` and `mint()` both require `mintForm().valid()`). These IDs
 * only ever populate the preview render.
 */
const PREVIEW_FALLBACK_SIDES = [
  'df58fbb44dbb2a9b17405f944c8ff966fd120cccda87873f3206f012ea239bebi0', // 1
  'ad8d751046787e22a0ef89a15b7f0e5eedae927a488a8ecc7e30711a7692fb11i0', // 2
  'fe4e588430b19d6e8b81005a3515a0f634fb3cd3b3bdf372bc7b12b50e302acci0', // 3
  '9825f7f09818f0adb7d3b20a4db6aa92f9af850bd4e0597db6b7ade3790b0f5bi0', // 4
  '412cb15b19496075ef9afbd07fbabe6d6e08461c30845fafe4ece083fd20d84fi0', // 5
  '81c64b1c7dfa8ce4e9e32dbcf68fbb51e004fb56be5b2253c880cd833ae74bcai0', // 6
];

/**
 * Sentinel prefix on the red Warning HTML returned by getCubeHtml
 * when the built body doesn't round-trip through parseCube. Exported
 * so consumers (start.component's mint()) can refuse to broadcast
 * this shape instead of encoding + signing it onto Bitcoin forever.
 */
export const CUBE_HTML_WARNING_SENTINEL = '<html style="color:red"><h1>Warning!';

export function isCubeWarningHtml(html: string): boolean {
  return html.startsWith(CUBE_HTML_WARNING_SENTINEL);
}

function fallbackIfNotValidId(inscriptionId: string, fallback: string): string {
  if (!inscriptionId || !isValidInscriptionId(inscriptionId)) return fallback;
  return inscriptionId;
}

/**
 * HTML-safe entity escape for text that lands inside `<title>...</title>`.
 * Encodes exactly the four characters parseCube's regex + unescape
 * mirror-map can handle: `&` `<` `>` `"`. Order matters: `&` FIRST so
 * subsequent replacements do not hit the `&amp;` output of the first
 * step. Uses global regex so a title containing multiple offenders
 * (e.g. `A < B < C`) is escaped fully.
 */
export function escapeCubeTitle(raw: string): string {
  return raw.replace(/[&<>"]/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default:  return c;
    }
  });
}

/**
 * Defensive strip for the five hidden concat fields (rotation speeds
 * + colours). The regex `[^']*` inside parseCube's `t='...'` capture
 * treats a raw single quote as a terminator, so a `'` in any of these
 * would break the round-trip and force the Warning fallback. A raw
 * `|` would silently misalign the `.split('|')` at parseCube:43 and
 * corrupt the traits without triggering the fallback.
 *
 * These fields are not exposed as inputs in the current GUI, but
 * stripping here means a future template change can't retroactively
 * open the hole without also removing this defence.
 */
function stripConcatUnsafe(field: string): string {
  return field.replace(/['|]/g, '');
}

/**
 * Pipe-joins the six inscription IDs + rotation speeds + colour data
 * that populate `t=` in the generated cube HTML. Trailing empty
 * fields get stripped so the on-chain body is a byte or two smaller.
 */
export function getConcatenatedCubeData({
  inscriptionIds,
  rotationSpeedX,
  rotationSpeedY,
  colorPane,
  bgColor1,
  bgColor2,
}: CubeDetails): string {
  const t =
    fallbackIfNotValidId(inscriptionIds.inscriptionId1, PREVIEW_FALLBACK_SIDES[0]) + '|' +
    fallbackIfNotValidId(inscriptionIds.inscriptionId2, PREVIEW_FALLBACK_SIDES[1]) + '|' +
    fallbackIfNotValidId(inscriptionIds.inscriptionId3, PREVIEW_FALLBACK_SIDES[2]) + '|' +
    fallbackIfNotValidId(inscriptionIds.inscriptionId4, PREVIEW_FALLBACK_SIDES[3]) + '|' +
    fallbackIfNotValidId(inscriptionIds.inscriptionId5, PREVIEW_FALLBACK_SIDES[4]) + '|' +
    fallbackIfNotValidId(inscriptionIds.inscriptionId6, PREVIEW_FALLBACK_SIDES[5]) + '|' +
    stripConcatUnsafe(rotationSpeedX) + '|' +
    stripConcatUnsafe(rotationSpeedY) + '|' +
    stripConcatUnsafe(colorPane) + '|' +
    stripConcatUnsafe(bgColor1) + '|' +
    stripConcatUnsafe(bgColor2);
  return removeTrailingPipes(t);
}

/**
 * Full cube HTML body, ready to hand to
 * `InscribeMintOrchestrator.setContent({body: encoded(html), ...})`.
 * If parseCube can't round-trip the assembled body, returns a
 * human-readable Warning page whose prefix matches
 * `CUBE_HTML_WARNING_SENTINEL` — mint() checks that prefix and
 * refuses to broadcast, so the fallback stays a preview-only
 * signal.
 */
export function getCubeHtml(cubeDetails: CubeDetails): string {
  const t = getConcatenatedCubeData(cubeDetails);

  let head: string;
  if (cubeDetails.title) {
    const title = escapeCubeTitle(cubeDetails.title);
    // The replacement MUST be a function. With a string, `$$`, `$&`, `$\`` and
    // `$'` are substitution patterns rather than characters, so a title
    // containing a dollar sign is rewritten on its way into the body: "Worth
    // $$$" inscribes as "Worth $$", and "A $& B" inscribes the `__TITLE__`
    // placeholder itself. Both round-trip through parseCube, so nothing refuses
    // them and the wrong bytes are signed, paid for and permanent.
    head = TEMPLATE_HEAD_WITH_TITLE.replace('__TITLE__', () => title);
  } else {
    head = TEMPLATE_HEAD_NO_TITLE;
  }

  const html = head + t + TEMPLATE_TAIL;

  if (!parseCube(html)) {
    return `${CUBE_HTML_WARNING_SENTINEL}</h1>You have entered data that would create an invalid cube. Please send us an email and a direct message (DM) so we can determine what went wrong.</html>`;
  }

  return html;
}
