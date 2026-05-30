import { render, screen, fireEvent } from '@testing-library/react-native';
import { HeroModule } from './HeroModule';
import type { CurrentObservation } from '@weather-cloud/shared';

// Mock the store
jest.mock('../weather.store', () => ({
  useWeatherStore: (selector: (s: { toggleUnits: () => void }) => unknown) =>
    selector({ toggleUnits: jest.fn() }),
}));

const mockCurrent: CurrentObservation = {
  stationId: 'KCATRUCK306',
  neighborhood: 'Denver Tech Center',
  observationTime: '2026-04-05T14:30:00',
  lat: 39.7,
  lon: -104.9,
  temp: 68,
  feelsLike: 65,
  dewPoint: 42,
  humidity: 35,
  pressure: 29.95,
  precipRate: 0,
  precipTotal: 0,
  windSpeed: 8,
  windDir: 315,
  windGust: 12,
  uv: 4,
  solarRadiation: 600,
  units: 'e',
};

describe('HeroModule', () => {
  it('displays rounded temperature', () => {
    render(<HeroModule current={mockCurrent} units="e" testID="hero" />);
    expect(screen.getByTestId('hero-temp')).toBeTruthy();
    expect(screen.getByText('68')).toBeTruthy();
  });

  it('displays neighborhood name', () => {
    render(<HeroModule current={mockCurrent} units="e" />);
    expect(screen.getByText('Denver Tech Center')).toBeTruthy();
  });

  it('displays feels-like when available', () => {
    render(<HeroModule current={mockCurrent} units="e" />);
    expect(screen.getByTestId('hero-feels-like')).toBeTruthy();
  });

  it('does not show feels-like when null', () => {
    const current = { ...mockCurrent, feelsLike: null };
    render(<HeroModule current={current} units="e" />);
    expect(screen.queryByTestId('hero-feels-like')).toBeNull();
  });

  it('shows unit toggle button', () => {
    render(<HeroModule current={mockCurrent} units="e" />);
    expect(screen.getByTestId('unit-toggle')).toBeTruthy();
    expect(screen.getByText('°F')).toBeTruthy();
  });

  it('shows metric unit label when units=m', () => {
    render(<HeroModule current={{ ...mockCurrent, units: 'm' }} units="m" />);
    expect(screen.getByText('°C')).toBeTruthy();
  });
});
