import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from './Home';

describe('Home', () => {
  it('reports that setup is complete', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { name: 'Setup complete' })).toBeInTheDocument();
  });

  it('shows the 20-stage career count', () => {
    render(<Home />);
    expect(screen.getByText('Career stages')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });
});
