import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import MateriasPage from './Materias';
import { api } from '../api/client';
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ tieneRol: () => true }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('crea materia con cero créditos y ciclo en preparación sin activar el vigente', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: [] }); const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
  render(<MateriasPage />);
  fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'MAT' } }); fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Matemáticas' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar materia' }));
  await waitFor(() => expect(post).toHaveBeenCalledWith('/academico/materias', expect.objectContaining({ creditos: 0 })));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Guardar materia' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('Clave del ciclo'), { target: { value: '2027' } }); fireEvent.change(screen.getByLabelText('Nombre del ciclo'), { target: { value: '2027-2028' } }); fireEvent.change(screen.getByLabelText('Inicio'), { target: { value: '2027-08-01' } }); fireEvent.change(screen.getByLabelText('Fin'), { target: { value: '2028-07-31' } }); fireEvent.click(screen.getByRole('button', { name: 'Guardar ciclo en preparación' }));
  await waitFor(() => expect(post).toHaveBeenCalledWith('/academico/ciclos', { clave: '2027', nombre: '2027-2028', fechaInicio: '2027-08-01', fechaFin: '2028-07-31' }));
});
it('preserva datos después de fallo y permite reintentar', async () => { vi.spyOn(api, 'get').mockResolvedValue({ data: [] }); vi.spyOn(api, 'post').mockRejectedValue(new Error('Sin conexión')); render(<MateriasPage />); fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'MAT' } }); fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Materia' } }); fireEvent.click(screen.getByRole('button', { name: 'Guardar materia' })); await screen.findByRole('alert'); expect((screen.getByLabelText('Clave') as HTMLInputElement).value).toBe('MAT'); expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Materia'); });
