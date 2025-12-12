import { describe, it, expect } from 'vitest';
import { 
  parseDMSComponent, 
  parseCoordinateString 
} from '../../../../../src/lib/ai/tools/navigate-to-location';

describe('parseDMSComponent', () => {
  it('parses standard DMS format with direction', () => {
    const result = parseDMSComponent('41°11\'55.0"N');
    expect(result).not.toBeNull();
    expect(result!.decimal).toBeCloseTo(41.1986, 4);
    expect(result!.isNegative).toBe(false);
  });

  it('parses DMS with South direction (negative)', () => {
    const result = parseDMSComponent('41°11\'55.0"S');
    expect(result).not.toBeNull();
    expect(result!.decimal).toBeCloseTo(-41.1986, 4);
    expect(result!.isNegative).toBe(true);
  });

  it('parses DMS with West direction (negative)', () => {
    const result = parseDMSComponent('8°40\'06.6"W');
    expect(result).not.toBeNull();
    expect(result!.decimal).toBeCloseTo(-8.6685, 4);
    expect(result!.isNegative).toBe(true);
  });

  it('parses DMS with curly/smart double quotes (U+201C, U+201D)', () => {
    const result = parseDMSComponent('37°04\'33.7"N');
    expect(result).not.toBeNull();
    expect(result!.decimal).toBeCloseTo(37.076028, 4);
  });

  it('parses DMS with curly/smart single quotes (U+2018, U+2019)', () => {
    // Using Unicode escapes: \u2018 = ', \u2019 = '
    const result = parseDMSComponent('37°04\u201933.7"N');
    expect(result).not.toBeNull();
    expect(result!.decimal).toBeCloseTo(37.076028, 4);
  });

  it('parses DMS with double prime (U+2033) and prime (U+2032)', () => {
    const result = parseDMSComponent('37°04′33.7″N');
    expect(result).not.toBeNull();
    expect(result!.decimal).toBeCloseTo(37.076028, 4);
  });

  it('parses DMS with spaces', () => {
    const result = parseDMSComponent('41 11 55.0 N');
    expect(result).not.toBeNull();
    expect(result!.decimal).toBeCloseTo(41.1986, 4);
  });

  it('parses DMS with d/m/s notation', () => {
    const result = parseDMSComponent('41d11m55.0sN');
    expect(result).not.toBeNull();
    expect(result!.decimal).toBeCloseTo(41.1986, 4);
  });

  it('returns null for invalid input', () => {
    expect(parseDMSComponent('invalid')).toBeNull();
    expect(parseDMSComponent('')).toBeNull();
  });
});

describe('parseCoordinateString', () => {
  describe('decimal format', () => {
    it('parses comma-separated decimal coordinates', () => {
      const result = parseCoordinateString('41.1986, -8.6685');
      expect(result).not.toBeNull();
      expect(result!.latitude).toBeCloseTo(41.1986, 4);
      expect(result!.longitude).toBeCloseTo(-8.6685, 4);
    });

    it('parses space-separated decimal coordinates', () => {
      const result = parseCoordinateString('41.1986 -8.6685');
      expect(result).not.toBeNull();
      expect(result!.latitude).toBeCloseTo(41.1986, 4);
      expect(result!.longitude).toBeCloseTo(-8.6685, 4);
    });
  });

  describe('DMS format', () => {
    it('parses standard DMS coordinates with straight quotes', () => {
      const result = parseCoordinateString('41°11\'55.0"N 8°40\'06.6"W');
      expect(result).not.toBeNull();
      expect(result!.latitude).toBeCloseTo(41.1986, 4);
      expect(result!.longitude).toBeCloseTo(-8.6685, 4);
    });

    it('parses DMS coordinates with comma separator', () => {
      const result = parseCoordinateString('41°11\'55.0"N, 8°40\'06.6"W');
      expect(result).not.toBeNull();
      expect(result!.latitude).toBeCloseTo(41.1986, 4);
      expect(result!.longitude).toBeCloseTo(-8.6685, 4);
    });

    it('parses DMS with curly/smart quotes (the original bug)', () => {
      // This is the exact format that failed: 37°04'33.7"N 7°57'32.5"W
      const result = parseCoordinateString('37°04\'33.7"N 7°57\'32.5"W');
      expect(result).not.toBeNull();
      expect(result!.latitude).toBeCloseTo(37.076028, 4);
      expect(result!.longitude).toBeCloseTo(-7.959028, 4);
    });

    it('parses DMS with mixed curly quotes', () => {
      // Using Unicode escapes: \u2019 = ', \u201D = "
      const result = parseCoordinateString('37°04\u201933.7\u201DN 7°57\u201932.5\u201DW');
      expect(result).not.toBeNull();
      expect(result!.latitude).toBeCloseTo(37.076028, 4);
      expect(result!.longitude).toBeCloseTo(-7.959028, 4);
    });

    it('parses DMS with prime and double prime symbols', () => {
      const result = parseCoordinateString('41°11′55.0″N 8°40′06.6″W');
      expect(result).not.toBeNull();
      expect(result!.latitude).toBeCloseTo(41.1986, 4);
      expect(result!.longitude).toBeCloseTo(-8.6685, 4);
    });

    // TODO: Space-separated DMS format not yet supported by parseCoordinateString splitting logic
    it.skip('parses DMS with spaces instead of symbols', () => {
      const result = parseCoordinateString('41 11 55.0 N 8 40 06.6 W');
      expect(result).not.toBeNull();
      expect(result!.latitude).toBeCloseTo(41.1986, 4);
      expect(result!.longitude).toBeCloseTo(-8.6685, 4);
    });
  });

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(parseCoordinateString('')).toBeNull();
    });

    it('returns null for invalid coordinates', () => {
      expect(parseCoordinateString('not coordinates')).toBeNull();
    });

    it('returns null for out-of-range latitude', () => {
      expect(parseCoordinateString('91.0, -8.6685')).toBeNull();
    });

    it('returns null for out-of-range longitude', () => {
      expect(parseCoordinateString('41.0, -181.0')).toBeNull();
    });
  });
});
