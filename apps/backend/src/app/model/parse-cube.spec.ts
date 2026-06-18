import { parseCube } from '../../shared/ordinals/parse-cube';


describe('parseCube', () => {
  it('should correctly parse the given cubeHtmlRaw string without a title', () => {

    const cubeHtmlRaw = `<html><!--cubes.haushoppe.art--><body><script>t='aaa|bbb|ccc|ddd|eee|fff|extra|data'</script><script src=/content/fed0eb2d943b1b6ce83c1d7bfb4639d3d44c7fdb161b1037c2fadaf630e55a55i0></script>`;
    const expected = [
      { 'trait_type': 'Side 1', 'value': 'aaa' },
      { 'trait_type': 'Side 2', 'value': 'bbb' },
      { 'trait_type': 'Side 3', 'value': 'ccc' },
      { 'trait_type': 'Side 4', 'value': 'ddd' },
      { 'trait_type': 'Side 5', 'value': 'eee' },
      { 'trait_type': 'Side 6', 'value': 'fff' },
      { 'trait_type': 'Version', 'value': 'v3' }
    ];

    const result = parseCube(cubeHtmlRaw);
    expect(result).toEqual(expected);
  });

  it('should correctly parse the given cubeHtmlRaw string with a title', () => {

    const cubeHtmlRaw = `<html><!--cubes.haushoppe.art--><head><title>Cube Test</title></head><body><script>t='aaa|bbb|ccc|ddd|eee|fff|extra|data'</script><script src=/content/fed0eb2d943b1b6ce83c1d7bfb4639d3d44c7fdb161b1037c2fadaf630e55a55i0></script>`;
    const expected = [
      { 'trait_type': 'Side 1', 'value': 'aaa' },
      { 'trait_type': 'Side 2', 'value': 'bbb' },
      { 'trait_type': 'Side 3', 'value': 'ccc' },
      { 'trait_type': 'Side 4', 'value': 'ddd' },
      { 'trait_type': 'Side 5', 'value': 'eee' },
      { 'trait_type': 'Side 6', 'value': 'fff' },
      { 'trait_type': 'Version', 'value': 'v3' },
      { 'trait_type': 'Title', 'value': 'Cube Test' }
    ];

    const result = parseCube(cubeHtmlRaw);
    expect(result).toEqual(expected);
  });

  it('should handle &gt; and &gt; in the title', () => {

    const cubeHtmlRaw = `<html><!--cubes.haushoppe.art--><head><title>Cube &lt; &gt; Test</title></head><body><script>t='aaa|bbb|ccc|ddd|eee|fff|extra|data'</script><script src=/content/fed0eb2d943b1b6ce83c1d7bfb4639d3d44c7fdb161b1037c2fadaf630e55a55i0></script>`;
    const expected = [
      { 'trait_type': 'Side 1', 'value': 'aaa' },
      { 'trait_type': 'Side 2', 'value': 'bbb' },
      { 'trait_type': 'Side 3', 'value': 'ccc' },
      { 'trait_type': 'Side 4', 'value': 'ddd' },
      { 'trait_type': 'Side 5', 'value': 'eee' },
      { 'trait_type': 'Side 6', 'value': 'fff' },
      { 'trait_type': 'Version', 'value': 'v3' },
      { 'trait_type': 'Title', 'value': 'Cube < > Test' }
    ];

    const result = parseCube(cubeHtmlRaw);
    expect(result).toEqual(expected);
  });

  it('should reject cubes without the HTML comment', () => {
    const cubeHtmlRaw = `<html><head><title>Cube &gt; Test</title></head><body><script>t='aaa|bbb|ccc|ddd|eee|fff|extra|data'</script><script src=/content/fed0eb2d943b1b6ce83c1d7bfb4639d3d44c7fdb161b1037c2fadaf630e55a55i0></script>`;
    const result = parseCube(cubeHtmlRaw);
    expect(result).toEqual(null);
  });

  it('should reject cubes without the data', () => {
    const cubeHtmlRaw = `<html><!--cubes.haushoppe.art--><body><script>XXX</script><script src=/content/fed0eb2d943b1b6ce83c1d7bfb4639d3d44c7fdb161b1037c2fadaf630e55a55i0></script>`;
    const result = parseCube(cubeHtmlRaw);
    expect(result).toEqual(null);
  });

  it('should reject cubes with an unknown version', () => {
    const cubeHtmlRaw = `<html><!--cubes.haushoppe.art--><body><script>t='aaa|bbb|ccc|ddd|eee|fff|extra|data'</script><script src=/content/XXX></script>`;
    const result = parseCube(cubeHtmlRaw);
    expect(result).toEqual(null);
  });

  it('should reject cubes that have an XSS attack via the `<` character', () => {
    const cubeHtmlRaw = `<html><!--cubes.haushoppe.art--><head><title>Cube < Test</title></head><body><script>t='aaa|bbb|ccc|ddd|eee|fff|extra|data'</script><script src=/content/fed0eb2d943b1b6ce83c1d7bfb4639d3d44c7fdb161b1037c2fadaf630e55a55i0></script>`;
    const result = parseCube(cubeHtmlRaw);
    expect(result).toEqual(null);
  });

  it('should reject cubes that have an XSS attack via the `>` character', () => {
    const cubeHtmlRaw = `<html><!--cubes.haushoppe.art--><head><title>Cube > Test</title></head><body><script>t='aaa|bbb|ccc|ddd|eee|fff|extra|data'</script><script src=/content/fed0eb2d943b1b6ce83c1d7bfb4639d3d44c7fdb161b1037c2fadaf630e55a55i0></script>`;
    const result = parseCube(cubeHtmlRaw);
    expect(result).toEqual(null);
  });
});


