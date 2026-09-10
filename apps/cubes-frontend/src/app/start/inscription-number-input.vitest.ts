import { inscriptionNumberFromInput } from './inscription-number-input';

describe('inscriptionNumberFromInput', () => {
  it('accepts a bare number', () => {
    expect(inscriptionNumberFromInput('12345')).toBe('12345');
  });

  it('accepts a #-prefixed number (the field hint promises #12345)', () => {
    expect(inscriptionNumberFromInput('#12345')).toBe('12345');
  });

  it('resolves #0 and 0 identically (inscription 0)', () => {
    expect(inscriptionNumberFromInput('#0')).toBe('0');
    expect(inscriptionNumberFromInput('0')).toBe('0');
  });

  it('trims surrounding whitespace around a #-number', () => {
    expect(inscriptionNumberFromInput('  # 42  ')).toBe('42');
  });

  it('returns null for a full inscription id so it is left untouched', () => {
    const id = 'a'.repeat(64) + 'i0';
    expect(inscriptionNumberFromInput(id)).toBeNull();
  });

  it('returns null for empty / non-numeric input', () => {
    expect(inscriptionNumberFromInput('')).toBeNull();
    expect(inscriptionNumberFromInput('   ')).toBeNull();
    expect(inscriptionNumberFromInput('#')).toBeNull();
    expect(inscriptionNumberFromInput('12x')).toBeNull();
  });
});
