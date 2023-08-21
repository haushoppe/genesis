import { removeTrailingPipes } from './mint-service-remove-trailing-pipes';

describe('removeTrailingPipes', () => {

  it('should remove single trailing pipe', () => {
      const result = removeTrailingPipes('hello|world|');
      expect(result).toEqual('hello|world');
  });

  it('should remove multiple trailing pipes', () => {
      const result = removeTrailingPipes('hello|world|||');
      expect(result).toEqual('hello|world');
  });

  it('should keep pipes in the middle of the string', () => {
      const result = removeTrailingPipes('hello||world|');
      expect(result).toEqual('hello||world');
  });

  it('should remove single trailing pipe from a simple string', () => {
      const result = removeTrailingPipes('hello|');
      expect(result).toEqual('hello');
  });

  it('should return the same string if there are no trailing pipes', () => {
      const result = removeTrailingPipes('hello');
      expect(result).toEqual('hello');
  });

  it('should handle undefined input', () => {
    const result = removeTrailingPipes(undefined);
    expect(result).toEqual('');
  });

  it('should handle null input', () => {
      const result = removeTrailingPipes(null);
      expect(result).toEqual('');
  });

  it('should handle empty string input', () => {
      const result = removeTrailingPipes('');
      expect(result).toEqual('');
  });
});
