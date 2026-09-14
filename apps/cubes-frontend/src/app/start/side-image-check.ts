/**
 * Does a side inscription render on a cube face?
 *
 * The cube renderer loads every side through three.js' TextureLoader, a
 * plain `<img>`: a face is black exactly when the browser cannot decode
 * the side as an image (missing inscription, text, HTML, JSON, a 3D
 * model, undecodable bytes). A black face makes the cube "cursed" in the
 * rarity score, so the mint form asks the browser the renderer's own
 * question before it lets a cube through. The cubes index runs the same
 * check in headless Chrome against the same host, so both agree.
 *
 * The check is a quality guard, not a safety one: getting it wrong costs a
 * rarity score, never money. So it must never be able to hard-stop a mint on
 * its own account. An answer that never arrives is `unknown`, which does not
 * block and does not accuse the reader's inscriptions of anything.
 */

/**
 * `black` is an ANSWER: the browser reached the bytes and could not decode
 * them as an image. `unknown` is the ABSENCE of an answer, from a probe that
 * did not finish in time, and the two must not be conflated. A blocked or slow
 * content host makes every side look undecodable, and treating that as `black`
 * disables minting and tells the reader their six inscriptions are broken.
 */
export type SideImageVerdict = 'ok' | 'black' | 'unknown';

/**
 * How long one side gets to answer before the probe gives up on it.
 *
 * An `<img>` reports neither a status code nor a timeout: `onerror` fires the
 * same way for a 404 and for a refused connection, and a socket that opens and
 * never delivers bytes fires nothing at all until the browser's own timeout,
 * minutes later. Without a deadline here a single stalled load withholds every
 * other side's verdict too, because they are awaited together.
 */
export const SIDE_PROBE_TIMEOUT_MS = 8_000;

/** Minimal `Image` surface the probe needs; the DOM `Image` satisfies it. */
export type ProbeImage = Pick<HTMLImageElement, 'naturalWidth' | 'naturalHeight' | 'onload' | 'onerror' | 'src'>;

export type ProbeImageFactory = () => ProbeImage;

const domImage: ProbeImageFactory = () => new Image();

/**
 * Resolves `ok` when the browser decodes `/content/<id>` as an image with a
 * real size, `black` when it reaches the bytes and cannot, and `unknown` when
 * nothing came back inside {@link SIDE_PROBE_TIMEOUT_MS}.
 */
export function probeSideImage(
  id: string,
  contentBase: string,
  createImage: ProbeImageFactory = domImage,
  timeoutMs: number = SIDE_PROBE_TIMEOUT_MS,
): Promise<SideImageVerdict> {
  return new Promise((resolve) => {
    const img = createImage();
    let settled = false;
    const settle = (verdict: SideImageVerdict) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(verdict);
    };
    const timer = setTimeout(() => settle('unknown'), timeoutMs);
    img.onload = () => settle(img.naturalWidth > 0 && img.naturalHeight > 0 ? 'ok' : 'black');
    img.onerror = () => settle('black');
    img.src = `${contentBase}/content/${id}`;
  });
}

/** Probes many ids at once; the result is keyed by id. */
export async function probeSideImages(
  ids: readonly string[],
  contentBase: string,
  createImage: ProbeImageFactory = domImage,
  timeoutMs: number = SIDE_PROBE_TIMEOUT_MS,
): Promise<Record<string, SideImageVerdict>> {
  const verdicts = await Promise.all(ids.map((id) => probeSideImage(id, contentBase, createImage, timeoutMs)));
  const result: Record<string, SideImageVerdict> = {};
  ids.forEach((id, i) => { result[id] = verdicts[i]; });
  return result;
}

/**
 * 1-based faces whose side is known to be black. Faces whose id has no
 * verdict yet (still probing, or not a checkable id) are not listed.
 */
export function blackFaces(
  sides: readonly string[],
  verdicts: Record<string, SideImageVerdict> | null | undefined,
): number[] {
  if (!verdicts) return [];
  const faces: number[] = [];
  sides.forEach((id, i) => {
    if (id && verdicts[id] === 'black') faces.push(i + 1);
  });
  return faces;
}

/**
 * True when no side is known to be black, so the mint may proceed.
 *
 * `unknown` passes on purpose. The gate exists to stop a cube that WILL have a
 * black face, and a probe that could not reach the content host has not
 * established that about anything. Blocking there would turn an outage of a
 * nice-to-have into a dead Mint button, which is the opposite of the rule this
 * component already applies to the fee recommendation.
 *
 * A side with NO verdict still blocks, which is a different case wearing a
 * similar name: the probe has not finished, so the question is still open
 * rather than answered with a shrug.
 */
export function allSidesRender(
  sides: readonly string[],
  verdicts: Record<string, SideImageVerdict> | null | undefined,
): boolean {
  if (!verdicts) return false;
  return sides.every((id) => id && verdicts[id] !== undefined && verdicts[id] !== 'black');
}
