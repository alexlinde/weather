import { render, screen } from '@testing-library/react-native';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('renders label, value and unit', () => {
    render(<StatCard label="Humidity" value={65} unit="%" />);
    expect(screen.getByText('Humidity')).toBeTruthy();
    expect(screen.getByText('65')).toBeTruthy();
    expect(screen.getByText('%')).toBeTruthy();
  });

  it('renders — when value is null', () => {
    render(<StatCard label="Pressure" value={null} unit="inHg" />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('renders optional sub text when provided', () => {
    render(<StatCard label="Precip Rate" value={0.05} unit="in/hr" sub="Total: 0.2 in" />);
    expect(screen.getByText('Total: 0.2 in')).toBeTruthy();
  });

  it('does not render sub text when omitted', () => {
    render(<StatCard label="UV" value={3} />);
    expect(screen.queryByText(/Total/)).toBeNull();
  });
});
