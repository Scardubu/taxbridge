import { render, screen } from '@testing-library/react';
import { HealthCard } from '@/components/HealthCard';

describe('HealthCard', () => {
  it('renders healthy status correctly', () => {
    render(
      <HealthCard
        title="Test API"
        status="healthy"
        latency={150}
        lastChecked="10:30 AM"
      />
    );

    expect(screen.getByText('Test API')).toBeInTheDocument();
    expect(screen.getByText('150ms')).toBeInTheDocument();
    expect(screen.getByText('HEALTHY')).toBeInTheDocument();
    expect(screen.getByText('Latency • Last checked 10:30 AM')).toBeInTheDocument();
  });

  it('renders degraded status correctly', () => {
    render(
      <HealthCard
        title="Test API"
        status="degraded"
        latency={500}
      />
    );

    expect(screen.getByText('DEGRADED')).toBeInTheDocument();
    expect(screen.getByText('500ms')).toBeInTheDocument();
  });

  it('renders error status with no latency', () => {
    render(
      <HealthCard
        title="Test API"
        status="error"
        latency={null}
      />
    );

    expect(screen.getByText('ERROR')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('displays last checked time when provided', () => {
    render(
      <HealthCard
        title="Test API"
        status="healthy"
        latency={200}
        lastChecked="2:45 PM"
      />
    );

    expect(screen.getByText('Latency • Last checked 2:45 PM')).toBeInTheDocument();
  });
});
