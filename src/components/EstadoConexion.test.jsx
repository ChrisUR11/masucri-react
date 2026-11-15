import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../hooks/useOfflineSync', () => ({
  useOfflineSync: vi.fn(),
}));
vi.mock('../hooks/useEstadoFirestore', () => ({
  useEstadoFirestore: vi.fn(),
}));

import { useOfflineSync } from '../hooks/useOfflineSync';
import { useEstadoFirestore } from '../hooks/useEstadoFirestore';
import EstadoConexion from './EstadoConexion';

describe('EstadoConexion', () => {
  beforeEach(() => {
    useOfflineSync.mockReturnValue({ offline: false });
    useEstadoFirestore.mockReturnValue({
      desdeCache: false,
      cambiosPendientes: false,
      revisionCache: 0,
    });
  });

  it('renders without a connection warning when everything is synchronized', () => {
    const { container } = render(<EstadoConexion />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows an offline status when the device has no connection', () => {
    useOfflineSync.mockReturnValue({ offline: true });

    render(<EstadoConexion />);

    expect(screen.getByRole('status')).toHaveTextContent('Sin conexión a internet.');
  });
});
