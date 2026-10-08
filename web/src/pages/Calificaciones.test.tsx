import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import CalificacionesPage from './Calificaciones';
import { api } from '../api/client';
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ tieneRol: () => true }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function preparar() {
  const clase = { id: 7, grupo: { id: 8,nombre: '1-A',ciclo: { nombre: '2026' },plantel: { nombre: 'Centro' } },materia: { clave: 'MAT',nombre: 'Matemáticas' } };
  vi.spyOn(api,'get').mockImplementation(async (url) => ({ data: url.includes('clases-seleccion') ? { datos: [clase],total: 1 } : url.endsWith('/alumnos') ? [{ alumno: { id: 1,matricula: 'AL1',usuario: { nombre: 'Ana',apellidoPaterno: 'Prueba' } } },{ alumno: { id: 2,matricula: 'AL2',usuario: { nombre: 'Luis',apellidoPaterno: 'Prueba' } } }] : url.endsWith('/historial') ? { datos: [],total: 0,pagina: 1,porPagina: 20 } : url.includes('/grupo-materia/') ? [{ alumnoId: 1,calificacion: 80.25 }] : { estatus: 'ABIERTO',inscritos: 2,capturados: 1,faltantes: 1 } }));
  render(<CalificacionesPage />);
  await waitFor(() => expect((screen.getByLabelText('Clase') as HTMLSelectElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('Clase'),{ target: { value: '7' } }); fireEvent.click(screen.getByRole('button',{ name: 'Cargar lista' }));
  await screen.findByLabelText('Calificación de AL1');
}
it('no envía una captura idéntica ni elimina notas al dejarlas vacías',async () => {
  const post = vi.spyOn(api,'post'); await preparar();
  fireEvent.click(screen.getByRole('button',{ name: 'Guardar calificaciones' })); await screen.findByText('No hay cambios que guardar.'); expect(post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Calificación de AL1'),{ target: { value: '' } }); fireEvent.click(screen.getByRole('button',{ name: 'Guardar calificaciones' })); expect(post).not.toHaveBeenCalled();
});
it('marca la nota inválida, mueve el foco y exige motivo antes de corregir',async () => {
  const post = vi.spyOn(api,'post'); await preparar(); const nota = screen.getByLabelText('Calificación de AL1');
  fireEvent.change(nota,{ target: { value: '101' } }); fireEvent.click(screen.getByRole('button',{ name: 'Guardar calificaciones' }));
  expect(nota.getAttribute('aria-invalid')).toBe('true'); expect(document.activeElement).toBe(nota); expect(post).not.toHaveBeenCalled();
  fireEvent.change(nota,{ target: { value: '90.25' } }); fireEvent.click(screen.getByRole('button',{ name: 'Guardar calificaciones' })); expect(document.activeElement).toBe(screen.getByLabelText('Motivo obligatorio al corregir una nota existente')); expect(post).not.toHaveBeenCalled();
});
it('conserva nota y motivo ante fallo; reintenta solo los cambios y evita duplicar captura',async () => {
  const post = vi.spyOn(api,'post').mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue({ data: { capturadas: 1,sinCambios: 0 } }); await preparar();
  fireEvent.change(screen.getByLabelText('Calificación de AL1'),{ target: { value: '90.25' } }); fireEvent.change(screen.getByLabelText('Motivo obligatorio al corregir una nota existente'),{ target: { value: 'Corrección autorizada' } });
  fireEvent.click(screen.getByRole('button',{ name: 'Guardar calificaciones' })); await screen.findByRole('alert');
  expect((screen.getByLabelText('Calificación de AL1') as HTMLInputElement).value).toBe('90.25'); expect((screen.getByLabelText('Motivo obligatorio al corregir una nota existente') as HTMLInputElement).value).toBe('Corrección autorizada');
  fireEvent.click(screen.getByRole('button',{ name: 'Guardar calificaciones' })); await screen.findByText('1 calificaciones guardadas');
  expect(post).toHaveBeenLastCalledWith('/calificaciones/captura',{ grupoMateriaId: 7,parcial: 1,motivo: 'Corrección autorizada',items: [{ alumnoId: 1,calificacion: 90.25 }] });
  await waitFor(() => expect((screen.getByRole('button',{ name: 'Guardar calificaciones' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button',{ name: 'Guardar calificaciones' })); await screen.findByText('No hay cambios que guardar.'); expect(post).toHaveBeenCalledTimes(2);
});
