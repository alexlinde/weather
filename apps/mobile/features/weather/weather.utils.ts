export const ICON_CODE_MAP: Record<number, string> = {
  0: '🌪️',
  1: '🌀',
  2: '🌀',
  3: '⛈️',
  4: '⛈️',
  5: '🌨️',
  6: '🌨️',
  7: '🌨️',
  8: '🌧️',
  9: '🌧️',
  10: '🌧️',
  11: '🌧️',
  12: '🌧️',
  13: '❄️',
  14: '❄️',
  15: '❄️',
  16: '❄️',
  17: '🌨️',
  18: '🌨️',
  19: '🌫️',
  20: '🌫️',
  21: '🌫️',
  22: '🌫️',
  23: '💨',
  24: '💨',
  25: '🥶',
  26: '☁️',
  27: '☁️',
  28: '☁️',
  29: '⛅',
  30: '⛅',
  31: '🌙',
  32: '☀️',
  33: '🌙',
  34: '☀️',
  35: '🌧️',
  36: '🔥',
  37: '⛈️',
  38: '⛈️',
  39: '🌧️',
  40: '🌧️',
  41: '❄️',
  42: '❄️',
  43: '❄️',
  45: '🌧️',
  46: '❄️',
  47: '⛈️',
};

export function getWeatherIcon(iconCode: number | null): string {
  if (iconCode === null) return '';
  return ICON_CODE_MAP[iconCode] ?? '🌡️';
}

const WIND_DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export function degToCardinal(deg: number | null): string {
  if (deg === null) return '—';
  return WIND_DIRS[Math.round(deg / 22.5) % 16] ?? '—';
}

export function formatTime(isoString: string | null): string {
  if (!isoString) return '—';
  const match = isoString.match(/[T ](\d{2}):(\d{2})/);
  if (!match) return '—';
  const hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${h12}:${minutes} ${period}`;
}

export function formatDate(isoString: string | null): string {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export const UNIT_LABELS = {
  e: { temp: '°F', speed: 'mph', pressure: 'inHg', precip: 'in', precipRate: 'in/hr' },
  m: { temp: '°C', speed: 'km/h', pressure: 'hPa', precip: 'mm', precipRate: 'mm/hr' },
} as const;

export type Units = 'e' | 'm';
