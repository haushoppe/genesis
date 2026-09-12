import { CubeRarity } from './types';

/** "face 2" / "faces 2, 3 and 5" */
export function facesLabel(faces: readonly number[]): string {
  if (faces.length === 1) return `face ${faces[0]}`;
  return `faces ${faces.slice(0, -1).join(', ')} and ${faces[faces.length - 1]}`;
}

/** Why a cube is cursed, in one sentence fragment per reason. */
export function curseLabel(cube: Pick<CubeRarity, 'cursed' | 'blackSides' | 'reusedSides'>): string {
  const reasons: string[] = [];
  for (const curse of cube.cursed) {
    switch (curse) {
      case 'duplicate-side':
        reasons.push('two faces show the same inscription');
        break;
      case 'black-side':
        reasons.push(`${facesLabel(cube.blackSides)} ${cube.blackSides.length === 1 ? 'is' : 'are'} black`);
        break;
      case 'reused-inscription':
        reasons.push(`${facesLabel(cube.reusedSides)} ${cube.reusedSides.length === 1 ? 'was' : 'were'} claimed by an earlier cube`);
        break;
    }
  }
  return reasons.join('; ');
}

/**
 * The badge for a cube whose sides the browser refuses as a texture source.
 * The maintainer's wording; these cubes rendered when they were minted.
 */
export const CHROME_CURSE_LABEL = 'Cursed | Chrome f*cked us';

/** The sentence under that badge, naming the faces it concerns. */
export function chromeCurseExplanation(faces: readonly number[]): string {
  const which = faces.length === 6
    ? 'Every side of this cube is'
    : `${facesLabel(faces).replace(/^f/, 'F')} ${faces.length === 1 ? 'is' : 'are'}`;
  return `${which} an SVG without a fixed size. Cubes like this rendered when they were minted. Chrome no longer accepts such an image as a 3D texture, so the face turns black in other viewers. Here it is redrawn and shows as intended.`;
}

/** "Side 2 does not render as an image" / "Sides 2 and 5 do not render as images" */
export function blackFacesLabel(faces: readonly number[]): string | null {
  if (faces.length === 0) return null;
  if (faces.length === 1) return `Side ${faces[0]} does not render as an image`;
  return `Sides ${faces.slice(0, -1).join(', ')} and ${faces[faces.length - 1]} do not render as images`;
}
