/**
 * Decodes a Base64-encoded data URI into its original content.
 *
 * @param uri - The data URI to decode.
 * @returns The decoded content as a string, or null if the URI is not a valid Base64-encoded data URI.
 */
export function decodeBase64DataURI(uri: string): string | null {
  const regex = /^data:.+\/(.+);base64,(.*)$/;
  const matches = uri.match(regex);

  if (!matches) {
      // console.log("The provided string is not a valid Base64-encoded data URI.");
      return null;
  }

  const [, , data] = matches;
  return atob(data);
}
