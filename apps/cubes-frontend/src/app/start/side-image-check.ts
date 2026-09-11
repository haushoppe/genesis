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
 */

export type SideImageVerdict = 'ok' | 'black';

/** Minimal `Image` surface the probe needs; the DOM `Image` satisfies it. */
export type ProbeImage = Pick<HTMLImageElement, 'naturalWidth' | 'naturalHeight' | 'onload' | 'onerror' | 'src'>;

export type ProbeImageFactory = () => ProbeImage;

const domImage: ProbeImageFactory = () => new Image();

/** Resolves `ok` when the browser decodes `/content/<id>` as an image with a real size. */
export function probeSideImage(
  id: string,
  contentBase: string,
  createImage: ProbeImageFactory = domImage,
): Promise<SideImageVerdict> {
  return new Promise((resolve) => {
    const img = createImage();
    img.onload = () => resolve(img.naturalWidth > 0 && img.naturalHeight > 0 ? 'ok' : 'black');
    img.onerror = () => resolve('black');
    img.src = `${contentBase}/content/${id}`;
  });
}

/** Probes many ids at once; the result is keyed by id. */
export async function probeSideImages(
  ids: readonly string[],
  contentBase: string,
  createImage: ProbeImageFactory = domImage,
): Promise<Record<string, SideImageVerdict>> {
  const verdicts = await Promise.all(ids.map((id) => probeSideImage(id, contentBase, createImage)));
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

/** True once every set side has a verdict, and none of them is black. */
export function allSidesRender(
  sides: readonly string[],
  verdicts: Record<string, SideImageVerdict> | null | undefined,
): boolean {
  if (!verdicts) return false;
  return sides.every((id) => id && verdicts[id] === 'ok');
}
