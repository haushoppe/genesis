import { withPreviewDarkCanvas } from './preview-dark-canvas';
import { getCubeHtml } from '../../services/cube-html';
import { parseCube } from '../../../shared/ordinals/parse-cube';

const CUBE = `<html><!--cubes.haushoppe.art--><body><script>t='x'</script></body></html>`;

describe('withPreviewDarkCanvas', () => {
  it('adds the dark color-scheme meta', () => {
    expect(withPreviewDarkCanvas(CUBE)).toContain('<meta name="color-scheme" content="dark">');
  });

  it('adds ONLY the meta — no base, no other injection', () => {
    const out = withPreviewDarkCanvas(CUBE);
    expect(out).not.toContain('<base');
    // exactly one head, holding only the meta
    expect(out).toContain('<head><meta name="color-scheme" content="dark"></head>');
  });

  it('is display-only: the wrapped preview is NOT a canonical cube', () => {
    // The mint body must stay pristine. The preview copy carries a meta in
    // its <head>, which the canon regex rejects (head may hold only a title),
    // so this shape can never be mistaken for a mintable cube.
    const sides = {
      inscriptionId1: 'a'.repeat(64) + 'i0', inscriptionId2: 'b'.repeat(64) + 'i0',
      inscriptionId3: 'c'.repeat(64) + 'i0', inscriptionId4: 'd'.repeat(64) + 'i0',
      inscriptionId5: 'e'.repeat(64) + 'i0', inscriptionId6: 'f'.repeat(64) + 'i0',
    };
    const pristine = getCubeHtml({ inscriptionIds: sides, title: '', rotationSpeedX: '', rotationSpeedY: '', colorPane: '', bgColor1: '', bgColor2: '' });
    expect(parseCube(pristine)).not.toBeNull();               // minted body is canon
    expect(parseCube(withPreviewDarkCanvas(pristine))).toBeNull(); // preview copy is not
  });
});
