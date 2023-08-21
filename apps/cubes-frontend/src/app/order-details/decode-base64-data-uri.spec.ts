import { decodeBase64DataURI } from "./decode-base64-data-uri";

describe('decodeBase64DataURI', () => {

  it('should decode base64 data URIs correctly', () => {
      const dataUri = "data:text/plain;base64,SGVsbG8gV29ybGQh"; // "Hello World!"
      const result = decodeBase64DataURI(dataUri);
      expect(result).toBe("Hello World!");
  });

  it('should return null for invalid data URIs', () => {
      const invalidDataUri = "data:text/plain,SGVsbG8gV29ybGQh";
      const result = decodeBase64DataURI(invalidDataUri);
      expect(result).toBeNull();
  });

  it('should decode data URIs with other types (e.g., image)', () => {
    // This is a base64-encoded 1x1 pixel transparent PNG image.
    const imageDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wcAAwAB/uLp1cAAAAAASUVORK5CYII=";
      const result = decodeBase64DataURI(imageDataUri);
      // Assuming we know the decoded value for the above data
      expect(result).not.toBeNull();
      expect(result?.length).toBeGreaterThan(10);
  });

  it('should handle very long data URIs', () => {
      const data = "A".repeat(10000);  // A string of 10,000 'A' characters
      const encodedData = btoa(data);
      const dataUri = `data:text/plain;base64,${encodedData}`;
      const result = decodeBase64DataURI(dataUri);
      expect(result).toBe(data);
  });

  it('should return null for data URIs missing the comma', () => {
      const dataUri = "data:text/plain;base64Hello%20World!";
      const result = decodeBase64DataURI(dataUri);
      expect(result).toBeNull();
  });
});
