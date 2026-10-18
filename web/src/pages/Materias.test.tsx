import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MateriasPage from './Materias';
import { api } from '../api/client';
const { tieneRol } = vi.hoisted(() => ({ tieneRol: vi.fn(() => true) }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ tieneRol }) }));
beforeEach(() => tieneRol.mockImplementation(() => true));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('crea materia con cero créditos y ciclo en preparación sin activar el vigente', async () => {
  vi.spyOn(api, 'get').mockImplementation(async url => ({ data: url === '/academico/materias/listado' ? { datos: [], total: 0 } : [] })); const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
  render(<MemoryRouter><MateriasPage /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'MAT' } }); fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Matemáticas' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar materia' }));
  await waitFor(() => expect(post).toHaveBeenCalledWith('/academico/materias', expect.objectContaining({ creditos: 0 })));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Guardar materia' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('Clave del ciclo'), { target: { value: '2027' } }); fireEvent.change(screen.getByLabelText('Nombre del ciclo'), { target: { value: '2027-2028' } }); fireEvent.change(screen.getByLabelText('Inicio'), { target: { value: '2027-08-01' } }); fireEvent.change(screen.getByLabelText('Fin'), { target: { value: '2028-07-31' } }); fireEvent.click(screen.getByRole('button', { name: 'Guardar ciclo en preparación' }));
  await waitFor(() => expect(post).toHaveBeenCalledWith('/academico/ciclos', { clave: '2027', nombre: '2027-2028', fechaInicio: '2027-08-01', fechaFin: '2028-07-31' }));
});
it('preserva datos después de fallo y permite reintentar', async () => { vi.spyOn(api, 'get').mockImplementation(async url => ({ data: url === '/academico/materias/listado' ? { datos: [], total: 0 } : [] })); vi.spyOn(api, 'post').mockRejectedValue(new Error('Sin conexión')); render(<MemoryRouter><MateriasPage /></MemoryRouter>); fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'MAT' } }); fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Materia' } }); fireEvent.click(screen.getByRole('button', { name: 'Guardar materia' })); await screen.findByRole('alert'); expect((screen.getByLabelText('Clave') as HTMLInputElement).value).toBe('MAT'); expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Materia'); });
it('cancelar una transición no anuncia éxito y un fallo conserva la clave para reintentar', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({ data: url === '/academico/materias/listado' ? { datos: [], total: 0 } : url.endsWith('/cierre') ? { grupos: 1, clases: 2, inscritos: 3, puedeCerrar: true, faltantes: [] } : [{ id: 4, clave: '2027', nombre: 'Ciclo', estado: 'PREPARACION', activo: false }] }));
  const post = vi.spyOn(api, 'post').mockRejectedValueOnce(new Error('Servidor temporalmente no disponible')).mockResolvedValue({ data: {} });
  render(<MemoryRouter><MateriasPage /></MemoryRouter>); fireEvent.click(await screen.findByText('Activar')); await screen.findByRole('dialog'); fireEvent.click(screen.getByText('Cancelar'));
  expect(post).not.toHaveBeenCalled(); expect(screen.queryByText('Operación completada')).toBeNull();
  fireEvent.click(screen.getByText('Activar')); await screen.findByRole('dialog'); fireEvent.change(screen.getByLabelText('Texto'), { target: { value: '2027' } }); fireEvent.click(screen.getByText('Confirmar'));
  await screen.findByRole('alert'); expect((screen.getByLabelText('Texto') as HTMLInputElement).value).toBe('2027'); expect(screen.queryByText('Operación completada')).toBeNull();
  fireEvent.click(screen.getByText('Confirmar')); await screen.findByText('Operación completada'); expect(post).toHaveBeenCalledTimes(2);
});

it('muestra los requisitos y tablas accesibles de materias y ciclos', async () => {
  vi.spyOn(api, 'get').mockImplementation(async url => ({ data: url === '/academico/materias/listado' ? { datos: [], total: 0 } : [] }));
  render(<MemoryRouter><MateriasPage /></MemoryRouter>);
  expect(screen.getByText(/Primero prepara el ciclo y el catálogo de materias/)).toBeTruthy();
  await waitFor(() => expect(screen.getByText(/No hay materias para esta búsqueda/)).toBeTruthy());
  expect(screen.getByRole('region', { name: 'Catálogo de materias' }).querySelector('.tabla-adaptable')).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Ciclos escolares' }).querySelector('.tabla-adaptable')).toBeTruthy();
});


it.each([false, true])('desactivación visible solo con SUPERADMIN: %s', async (superadmin) => {
  tieneRol.mockImplementation((...roles: string[]) => superadmin || roles.includes('ADMINISTRATIVO'));
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({ data: url === '/academico/materias/listado'
    ? { datos: [{ id: 9, clave: 'HIST', nombre: 'Historia', creditos: 2 }], total: 1 } : [] }));
  const eliminar = vi.spyOn(api, 'delete').mockResolvedValue({ data: { ok: true } });
  render(<MemoryRouter><MateriasPage /></MemoryRouter>);
  await screen.findByText('Historia');
  expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy();
  const boton = screen.queryByRole('button', { name: 'Desactivar' });
  if (!superadmin) { expect(boton).toBeNull(); expect(eliminar).not.toHaveBeenCalled(); return; }
  fireEvent.click(boton!);
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(eliminar).not.toHaveBeenCalled();
  fireEvent.click(boton!);
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(eliminar).toHaveBeenCalledWith('/academico/materias/9'));
});

it('consulta diez por página, conserva la búsqueda al paginar y la reinicia al buscar', async () => {
  const get = vi.spyOn(api, 'get').mockImplementation(async url => ({ data: url === '/academico/materias/listado' ? { datos: [{ id: 1, clave: 'MAT', nombre: 'Materia remota', creditos: 0 }], total: 115 } : [] }));
  render(<MemoryRouter initialEntries={['/materias?buscar=Fisica&pagina=3']}><MateriasPage /></MemoryRouter>);
  await screen.findByText('Materia remota');
  expect(get).toHaveBeenCalledWith('/academico/materias/listado', { params: { pagina: 3, porPagina: 10, buscar: 'Fisica' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ir a la página siguiente' }));
  await waitFor(() => expect(get).toHaveBeenCalledWith('/academico/materias/listado', { params: { pagina: 4, porPagina: 10, buscar: 'Fisica' } }));
  fireEvent.change(screen.getByLabelText('Buscar materias por clave o nombre'), { target: { value: 'Historia' } });
  await waitFor(() => expect(get).toHaveBeenCalledWith('/academico/materias/listado', { params: { pagina: 1, porPagina: 10, buscar: 'Historia' } }));
  expect(get.mock.calls.some(c => c[0] === '/academico/materias')).toBe(false);
});

it('edita tipo sin sobrescribir la descripción histórica y mantiene la baja solo para Superadmin', async () => {
  vi.spyOn(api, 'get').mockImplementation(async url => ({ data: url === '/academico/materias/listado' ? { datos: [{ id: 21, clave: 'LEG', nombre: 'Legada', creditos: 2, tipo: null, descripcion: 'Histórica' }], total: 1 } : [] }));
  const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: {} });
  render(<MemoryRouter><MateriasPage /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
  expect(screen.queryByLabelText('Descripción')).toBeNull();
  fireEvent.change(screen.getByLabelText('Tipo académico'), { target: { value: 'COMPLEMENTARIA' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar materia' }));
  await waitFor(() => expect(patch).toHaveBeenCalledWith('/academico/materias/21', { clave: 'LEG', nombre: 'Legada', creditos: 2, tipo: 'COMPLEMENTARIA' }));
});

it('ofrece desde cada ciclo el acceso directo a grupos de ese ciclo', async () => {
  vi.spyOn(api, 'get').mockImplementation(async url => ({ data: url === '/academico/materias/listado'
    ? { datos: [], total: 0 }
    : [{ id: 8, clave: '2027', nombre: '2027–2028', fechaInicio: '2027-08-01', fechaFin: '2028-07-31', estado: 'PREPARACION', activo: false }] }));
  render(<MemoryRouter><MateriasPage /></MemoryRouter>);
  const enlace = await screen.findByRole('link', { name: 'Ver grupos del ciclo 2027' });
  expect((enlace as HTMLAnchorElement).getAttribute('href')).toBe('/grupos?vista=consulta&ciclo=8');
});
