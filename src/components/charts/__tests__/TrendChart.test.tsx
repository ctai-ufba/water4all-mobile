import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendChart } from '../TrendChart';

describe('TrendChart', () => {
  it('shows daily values in an accessible chart description and readable end labels', () => {
    render(<TrendChart title="Daily balance" unit="m³/day" series={[{
      name: 'Net balance', color: '#34d399', points: [
        { date: '2026-03-02', label: 'Mar 2', value: -1.5 },
        { date: '2026-03-03', label: 'Mar 3', value: 2.25 },
      ],
    }]} />);

    const chart = screen.getByRole('img', { name: 'Daily balance' });
    expect(chart).toHaveTextContent('Mar 2: -1.50 m³/day');
    expect(chart).toHaveTextContent('Mar 3: 2.25 m³/day');
    expect(screen.getByText('Mar 2')).toBeInTheDocument();
    expect(screen.getByText('Mar 3')).toBeInTheDocument();
  });
});
