import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from './Dashboard';
import { api } from '../api/client';

const contexto = vi.hoisted(() => ({ roles: ['MAESTRO'] }));

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({
  sesion: { nombre: 'Usuario', roles: contexto.roles },
  tieneRol: (...roles: string[]) => contexto.roles.some((rol) => roles.includes(rol)),
}) }));

beforeEach(() => { contexto.roles = ['MAESTRO']; });

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Dashboard por roles', () => {
  it('consulta calendario y planteles sin pedir el resumen financiero prohibido', async () => {
    const obtener = vi.spyOn(api, 'get').mockResolvedValue({ data: [] });
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    await waitFor(() => expect(obtener).toHaveBeenCalledWith('/calendario', expect.anything()));
    expect(obtener.mock.calls.some(([ruta]) => ruta === '/reportes/resumen')).toBe(false);
    expect(screen.queryByText('Saldo pendiente')).toBeNull();
  });
  it('conserva indicadores escolares y financieros y sus accesos en cuentas de varios roles', async () => {
    contexto.roles = ['ADMINISTRATIVO', 'FINANZAS'];
    vi.spyOn(api, 'get').mockImplementation(async (ruta) => ({ data: ruta === '/reportes/resumen'
      ? { alumnosActivos: 20, docentesActivos: 10, grupos: 5, saldoPendiente: 500, cargosConAdeudo: 5, cobradoMes: 1000 } : [] }));
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(await screen.findByText('Alumnos activos')).toBeTruthy();
    expect(screen.getByText('Saldo pendiente')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Finanzas Da seguimiento/ }).getAttribute('href')).toBe('/finanzas');
    expect(screen.getByRole('link', { name: /Grupos Organiza/ }).getAttribute('href')).toBe('/grupos');
  });
});
