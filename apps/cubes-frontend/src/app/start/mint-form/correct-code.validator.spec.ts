import { CorrectCodeValidator } from './correct-code.validator';  // replace with the actual file name

describe('CorrectCodeValidator', () => {
  const validator = CorrectCodeValidator();

  it('should return null for null, empty, or whitespace strings', () => {
    const control1 = { value: null } as any;
    const control2 = { value: '' } as any;
    const control3 = { value: ' ' } as any;

    expect(validator(control1)).toBeNull();
    expect(validator(control2)).toBeNull();
    expect(validator(control3)).toBeNull();
  });

  it('should return null for strings ending with underscore and a number', () => {
    const control1 = { value: 'test_0' } as any;
    const control2 = { value: 'anotherTest_3500' } as any;

    expect(validator(control1)).toBeNull();
    expect(validator(control2)).toBeNull();
  });

  it('should return an error map for other strings', () => {
    const control1 = { value: 'invalidString' } as any;
    const control2 = { value: 'anotherInvalidString_abc' } as any;

    expect(validator(control1)).toEqual({ incorrectCode: { value: 'invalidString' } });
    expect(validator(control2)).toEqual({ incorrectCode: { value: 'anotherInvalidString_abc' } });
  });
});
