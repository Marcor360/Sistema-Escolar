import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from './Dashboard';
import { api } from '../api/client';

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({
  sesion: { nombre: 'Docente', roles: ['MAESTRO'] },
  tieneRol: (...roles: string[]) => roles.includes('MAESTRO'),
}) }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Dashboard de maestro', () => {
  it('consulta calendario y planteles sin pedir el resumen financiero prohibido', async () => {
    const obtener = vi.spyOn(api, 'get').mockResolvedValue({ data: [] });
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    await waitFor(() => expect(obtener).toHaveBeenCalledWith('/calendario', expect.anything()));
    expect(obtener.mock.calls.some(([ruta]) => ruta === '/reportes/resumen')).toBe(false);
    expect(screen.queryByText('Saldo pendiente')).toBeNull();
  });
});
