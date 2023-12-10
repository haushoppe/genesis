/**
 * Parses the given cube HTML string and extracts the attributes.
 *
 * @param {string} cubeHtmlRaw - The raw cube HTML string.
 *
 * @returns An array of attributes containing trait types and their values OR null if its a invalid cube
 */
export function parseCube(cubeHtmlRaw: string): { trait_type: string; value: string }[] | null {

  if (!cubeHtmlRaw) {
    return null;
  }

  const regexFull = /^<html><!--cubes\.haushoppe\.art-->(<head><title>([^<>]*)<\/title><\/head>)?<body><script>t='([^']*)'<\/script><script src=\/content\/([^>]*)><\/script>$/;
  const matchFull = cubeHtmlRaw.match(regexFull);

  var knownVersions = [
    '9475aa8df559d569f7284ce59e97014f28be758e832e212fdbba0202699dd035i0', // v1
    '4c5b32a1bd0dc43b3540097bf0135de6b0389f55fe6fe06910e5393bf6591a42i0', // v2
    'fed0eb2d943b1b6ce83c1d7bfb4639d3d44c7fdb161b1037c2fadaf630e55a55i0'  // v3
  ];

  /*
  Example:

  Match 1: <html><!--cubes.haushoppe.art--><head><title>Cube &lt; &gt; Test</title></head><body><script>t='aaa|bbb|ccc|ddd|eee|fff|extra|data'</script><script src=/content/fed0eb2d943b1b6ce83c1d7bfb4639d3d44c7fdb161b1037c2fadaf630e55a55i0></script>
  Group 1: <head><title>Cube &lt; &gt; Test</title></head>
  Group 2: Cube &lt; &gt; Test
  Group 3: aaa|bbb|ccc|ddd|eee|fff|extra|data
  Group 4: fed0eb2d943b1b6ce83c1d7bfb4639d3d44c7fdb161b1037c2fadaf630e55a55i0
  */

  if (matchFull) {

    const titleMatch = matchFull[2];
    const dataMatch = matchFull[3];
    const scriptIdMatch = matchFull[4];

    const data = dataMatch.split('|');

    const versionIndex = knownVersions.findIndex(v => v === scriptIdMatch);
    if (versionIndex === -1) {
      return null;
    }

    let traits = [
      { 'trait_type': 'Side 1', 'value': data[0] },
      { 'trait_type': 'Side 2', 'value': data[1] },
      { 'trait_type': 'Side 3', 'value': data[2] },
      { 'trait_type': 'Side 4', 'value': data[3] },
      { 'trait_type': 'Side 5', 'value': data[4] },
      { 'trait_type': 'Side 6', 'value': data[5] },
      { 'trait_type': 'Version', 'value': 'v' + (versionIndex + 1) }
    ];

    if (titleMatch) {
      const title = titleMatch
        .replace('&lt;', '<')
        .replace('&gt;', '>');

      traits = [...traits, { 'trait_type': 'Title', 'value': title }]
    }

    return traits;
  }

  return null;
}
