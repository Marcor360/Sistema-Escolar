import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ConductaPage from './Conducta';
import { api } from '../api/client';
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ tieneRol: () => false }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('muestra uso interno sin acciones para publicar al alumno', async () => { const get = vi.spyOn(api, 'get').mockImplementation(async (ruta) => ({ data: ruta === '/conducta/incidencias' ? { datos: [], total: 0, pagina: 1 } : [] })); render(<ConductaPage />); await waitFor(() => expect(get).toHaveBeenCalledWith('/academico/mis-grupos')); expect(screen.getByText(/Uso exclusivo del personal/)).not.toBeNull(); expect(screen.queryByRole('button', { name: /publicar|notificar alumno/i })).toBeNull(); expect(screen.getByLabelText('Descripción interna')).not.toBeNull(); });
