import { formatTime, degToCardinal, getWeatherIcon } from './weather.utils';

describe('formatTime', () => {
  it('returns dash for null', () => {
    expect(formatTime(null)).toBe('—');
  });

  it('returns dash for empty string', () => {
    expect(formatTime('')).toBe('—');
  });

  it('parses ISO string with timezone offset (station-local time)', () => {
    expect(formatTime('2026-04-05T06:30:00-0600')).toBe('6:30 AM');
    expect(formatTime('2026-04-05T19:45:00-0600')).toBe('7:45 PM');
  });

  it('parses ISO string without timezone offset', () => {
    expect(formatTime('2026-04-05T14:30:00')).toBe('2:30 PM');
  });

  it('parses space-separated datetime (PWS obsTimeLocal format)', () => {
    expect(formatTime('2026-04-05 14:30:00')).toBe('2:30 PM');
  });

  it('displays noon correctly', () => {
    expect(formatTime('2026-04-05T12:00:00-0600')).toBe('12:00 PM');
  });

  it('displays midnight correctly', () => {
    expect(formatTime('2026-04-05T00:15:00-0600')).toBe('12:15 AM');
  });

  it('preserves station-local time regardless of any offset', () => {
    // Same wall-clock time with different offsets should display identically
    expect(formatTime('2026-04-05T06:30:00-0600')).toBe('6:30 AM');
    expect(formatTime('2026-04-05T06:30:00+0530')).toBe('6:30 AM');
    expect(formatTime('2026-04-05T06:30:00Z')).toBe('6:30 AM');
  });
});

describe('degToCardinal', () => {
  it('returns dash for null', () => {
    expect(degToCardinal(null)).toBe('—');
  });

  it('returns N for 0 degrees', () => {
    expect(degToCardinal(0)).toBe('N');
  });

  it('returns E for 90 degrees', () => {
    expect(degToCardinal(90)).toBe('E');
  });
});

describe('getWeatherIcon', () => {
  it('returns empty string for null', () => {
    expect(getWeatherIcon(null)).toBe('');
  });

  it('returns sun for code 32', () => {
    expect(getWeatherIcon(32)).toBe('☀️');
  });

  it('returns fallback for unknown code', () => {
    expect(getWeatherIcon(999)).toBe('🌡️');
  });
});
