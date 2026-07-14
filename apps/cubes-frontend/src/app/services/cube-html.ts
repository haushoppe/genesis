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
 * Preview-only fallbacks — when the user hasn't picked a real
 * inscription for a side yet, the mint form renders a coloured
 * "side #" SVG. These IDs are asset paths, NOT valid inscription IDs,
 * so they never land on-chain (the mint gate rejects any cube whose
 * IDs don't all pass `isValidInscriptionId`).
 */
const PREVIEW_FALLBACK_SIDES = [
  '../assets/_______________________________________________side1.svg',
  '../assets/_______________________________________________side2.svg',
  '../assets/_______________________________________________side3.svg',
  '../assets/_______________________________________________side4.svg',
  '../assets/_______________________________________________side5.svg',
  '../assets/_______________________________________________side6.svg',
];

function fallbackIfNotValidId(inscriptionId: string, fallback: string): string {
  if (!inscriptionId || !isValidInscriptionId(inscriptionId)) return fallback;
  return inscriptionId;
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
    rotationSpeedX + '|' +
    rotationSpeedY + '|' +
    colorPane + '|' +
    bgColor1 + '|' +
    bgColor2;
  return removeTrailingPipes(t);
}

/**
 * Full cube HTML body, ready to hand to
 * `InscribeMintOrchestrator.setContent({body: encoded(html), ...})`.
 * If parseCube can't round-trip the assembled body, returns a
 * human-readable error page instead — the mint form filters that
 * out and blocks the mint action.
 */
export function getCubeHtml(cubeDetails: CubeDetails): string {
  const t = getConcatenatedCubeData(cubeDetails);

  let head: string;
  if (cubeDetails.title) {
    const title = cubeDetails.title.replace('<', '&lt;').replace('>', '&gt;');
    head = TEMPLATE_HEAD_WITH_TITLE.replace('__TITLE__', title);
  } else {
    head = TEMPLATE_HEAD_NO_TITLE;
  }

  const html = head + t + TEMPLATE_TAIL;

  if (!parseCube(html)) {
    return `<html style="color:red"><h1>Warning!</h1>You have entered data that would create an invalid cube. Please send us an email and a direct message (DM) so we can determine what went wrong.</html>`;
  }

  return html;
}
