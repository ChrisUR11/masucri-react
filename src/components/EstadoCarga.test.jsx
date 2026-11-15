import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EstadoCarga from './EstadoCarga';

describe('EstadoCarga', () => {
  it('renders its loading status and the supplied message', () => {
    render(<EstadoCarga texto="Cargando pedidos..." />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Cargando pedidos...')).toBeInTheDocument();
  });
});
