import { render, screen } from '@testing-library/react-native';
import { ForecastStrip } from './ForecastStrip';
import type { ForecastDay } from '@weather-cloud/shared';

const mockForecast: ForecastDay[] = [
  {
    dayOfWeek: 'Sunday',
    validDate: '2026-04-05',
    dayIcon: 34,
    dayPhrase: 'Mostly Sunny',
    dayPrecipChance: 10,
    dayTemp: 72,
    dayHumidity: 35,
    dayWindSpeed: 8,
    dayWindDir: 'NW',
    nightIcon: 31,
    nightPhrase: 'Mostly Clear',
    nightPrecipChance: 5,
    nightTemp: 48,
    nightHumidity: 55,
    nightWindSpeed: 5,
    nightWindDir: 'N',
    tempHigh: 72,
    tempLow: 48,
    sunrise: '2026-04-05T06:30:00',
    sunset: '2026-04-05T19:45:00',
    moonPhase: 'Waxing Gibbous',
  },
  {
    dayOfWeek: 'Monday',
    validDate: '2026-04-06',
    dayIcon: 26,
    dayPhrase: 'Cloudy',
    dayPrecipChance: 40,
    dayTemp: 65,
    dayHumidity: 55,
    dayWindSpeed: 12,
    dayWindDir: 'SW',
    nightIcon: 11,
    nightPhrase: 'Showers',
    nightPrecipChance: 70,
    nightTemp: 52,
    nightHumidity: 75,
    nightWindSpeed: 8,
    nightWindDir: 'S',
    tempHigh: 65,
    tempLow: 52,
    sunrise: '2026-04-06T06:29:00',
    sunset: '2026-04-06T19:46:00',
    moonPhase: 'Full Moon',
  },
];

describe('ForecastStrip', () => {
  it('renders the section header', () => {
    render(<ForecastStrip forecast={mockForecast} units="e" />);
    expect(screen.getByText('5-Day Forecast')).toBeTruthy();
  });

  it('shows Today for the first card', () => {
    render(<ForecastStrip forecast={mockForecast} units="e" />);
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('shows abbreviated day name for subsequent cards', () => {
    render(<ForecastStrip forecast={mockForecast} units="e" />);
    expect(screen.getByText('Mon')).toBeTruthy();
  });

  it('renders high temperature for the first day', () => {
    render(<ForecastStrip forecast={mockForecast} units="e" />);
    expect(screen.getByText('72°F')).toBeTruthy();
  });

  it('renders precipitation chance', () => {
    render(<ForecastStrip forecast={mockForecast} units="e" />);
    expect(screen.getByText('10%')).toBeTruthy();
  });

  it('renders both forecast cards', () => {
    render(<ForecastStrip forecast={mockForecast} units="e" testID="strip" />);
    expect(screen.getByTestId('forecast-card-2026-04-05')).toBeTruthy();
    expect(screen.getByTestId('forecast-card-2026-04-06')).toBeTruthy();
  });
});
