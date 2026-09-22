import { withPreviewDarkCanvas } from './preview-dark-canvas';
import { getCubeHtml } from '../../services/cube-html';
import { parseCube } from '../../../shared/ordinals/parse-cube';
import { STAGE_DEFAULTS, stageCss } from './cube-srcdoc';

const CUBE = `<html><!--cubes.haushoppe.art--><body><script>t='x'</script></body></html>`;

describe('withPreviewDarkCanvas', () => {
  it('adds the dark color-scheme meta', () => {
    expect(withPreviewDarkCanvas(CUBE)).toContain('<meta name="color-scheme" content="dark">');
  });

  it('adds the texture shim, so the preview renders what the gallery renders', () => {
    expect(withPreviewDarkCanvas(CUBE)).toContain('texSubImage2D');
  });

  it('reproduces the stage, which is what stops the flicker', () => {
    // Without this the document paints a flat dark canvas, the renderer then
    // injects its own sky and draws the floor in WebGL, and the step between
    // the two is visible on every re-render.
    expect(withPreviewDarkCanvas(CUBE)).toContain(`<style>${stageCss(STAGE_DEFAULTS)}</style>`);
  });

  it('stages in the CUBE\'s own colours, not the defaults', () => {
    // Fields 8, 9, 10 of the `t` list are floor, sky top, sky bottom. A cube
    // that overrides them must be staged in ITS colours, or the pre-render
    // frame is a different scene from the one the renderer paints.
    const custom = `<html><!--cubes.haushoppe.art--><body><script>t='a|b|c|d|e|f|g|h|#112233|#445566|#778899'</script></body></html>`;
    const out = withPreviewDarkCanvas(custom);
    expect(out).toContain(`<style>${stageCss({ k: '#112233', t: '#445566', u: '#778899' })}</style>`);
    expect(out).not.toContain(stageCss(STAGE_DEFAULTS));
  });

  it('adds no base: the preview resolves its sides against the app origin', () => {
    expect(withPreviewDarkCanvas(CUBE)).not.toContain('<base');
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
