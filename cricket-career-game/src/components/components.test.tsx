import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Avatar, Badge, Card, CardHeader, Crest, ProgressBar, StatTile, Stepper, Tabs } from './index';
import { initialsOf } from './Avatar';

const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Card', () => {
  it('renders a title, suffix, subtitle and action pill', () => {
    wrap(
      <Card>
        <CardHeader
          title="Player Stats"
          titleSuffix="(Current Season)"
          subtitle="Improve key skills"
          action={{ label: 'View All', to: '/stats' }}
        />
      </Card>,
    );
    expect(screen.getByRole('heading', { name: /Player Stats/ })).toBeInTheDocument();
    expect(screen.getByText('(Current Season)')).toBeInTheDocument();
    expect(screen.getByText('Improve key skills')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View All' })).toHaveAttribute('href', '/stats');
  });
});

describe('ProgressBar', () => {
  it('exposes its value to assistive technology', () => {
    render(<ProgressBar value={62} label="Batting Nets progress" />);
    const bar = screen.getByRole('progressbar', { name: 'Batting Nets progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '62');
  });

  it('clamps out-of-range values', () => {
    render(
      <>
        <ProgressBar value={-20} label="under" />
        <ProgressBar value={180} label="over" />
      </>,
    );
    expect(screen.getByRole('progressbar', { name: 'under' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByRole('progressbar', { name: 'over' })).toHaveAttribute('aria-valuenow', '100');
  });
});

describe('Tabs', () => {
  it('marks only the active tab as selected', () => {
    render(
      <Tabs
        tabs={[
          { id: 'u16', label: 'U-16' },
          { id: 't20', label: 'T20' },
        ]}
        value="u16"
        onChange={() => {}}
        label="Level"
      />,
    );
    expect(screen.getByRole('tab', { name: 'U-16' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'T20' })).toHaveAttribute('aria-selected', 'false');
  });
});

describe('Stepper', () => {
  const steps = [
    { id: 'a', index: 1, label: 'Beginner', status: 'done' as const },
    { id: 'b', index: 2, label: 'District', status: 'done' as const },
    { id: 'c', index: 3, label: 'State U-16', status: 'current' as const },
    { id: 'd', index: 4, label: 'U-19', status: 'locked' as const },
  ];

  it('numbers locked and current steps and ticks completed ones', () => {
    render(<Stepper steps={steps} endLabel="Retirement" />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(screen.getByText('Retirement')).toBeInTheDocument();
    expect(screen.getByText('current stage')).toBeInTheDocument();
  });

  it('keeps age-group labels from breaking across lines', () => {
    render(<Stepper steps={steps} />);
    expect(screen.getByText('State‑U‑16'.replace('‑U', ' U'))).toBeInTheDocument();
  });
});

describe('Badge, Avatar and Crest', () => {
  it('renders badge text', () => {
    render(<Badge tone="green">Won by 34 runs</Badge>);
    expect(screen.getByText('Won by 34 runs')).toBeInTheDocument();
  });

  it('derives initials from a name', () => {
    expect(initialsOf('CricketFan07')).toBe('CR');
    expect(initialsOf('Dinesh Kumar')).toBe('DK');
    expect(initialsOf('')).toBe('?');
  });

  it('falls back to initials when there is no photo', () => {
    render(<Avatar name="TNCricket" />);
    expect(screen.getByText('TN')).toBeInTheDocument();
  });

  it('draws a generic crest with the team monogram', () => {
    render(
      <Crest
        crest={{ monogram: 'TN', primaryColor: '#C0392B', secondaryColor: '#F5C518', shape: 'SHIELD' }}
        label="Tamil Nadu U-16"
      />,
    );
    expect(screen.getByRole('img', { name: 'Tamil Nadu U-16 crest' })).toBeInTheDocument();
    expect(screen.getByText('TN')).toBeInTheDocument();
  });
});

describe('StatTile', () => {
  it('renders a label and value', () => {
    render(<StatTile label="Strike Rate" value="71.7" />);
    expect(screen.getByText('Strike Rate')).toBeInTheDocument();
    expect(screen.getByText('71.7')).toBeInTheDocument();
  });
});
