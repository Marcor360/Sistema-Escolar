import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Shell } from './Shell';

const contexto = vi.hoisted(() => ({ roles: ['SUPERADMIN'] }));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    sesion: { nombre: 'Usuario', roles: contexto.roles },
    tieneRol: (...roles: string[]) =>
      contexto.roles.includes('SUPERADMIN') || contexto.roles.some((rol) => roles.includes(rol)),
    logout: vi.fn(),
  }),
}));
vi.mock('../marca/MarcaContext', () => ({
  useMarca: () => ({
    marca: { nombreInstitucion: 'Escuela', nombreCorto: 'E', logoUrl: null },
  }),
}));
vi.mock('../components/Campana', () => ({ Campana: () => null }));

let consulta: EventTarget & { matches: boolean };
beforeEach(() => {
  contexto.roles = ['SUPERADMIN'];
  consulta = Object.assign(new EventTarget(), { matches: true });
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => consulta),
  );
  document.body.style.overflow = 'auto';
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.style.overflow = '';
});

function abrirMenu() {
  const vista = render(
    <MemoryRouter>
      <Shell />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: /Abrir menú/ }));
  return vista;
}

it('restaura el scroll y el foco al cerrar con el fondo o Escape', () => {
  abrirMenu();
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar navegación' }));
  expect(document.body.style.overflow).toBe('auto');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: /Abrir menú/ }));
  fireEvent.click(screen.getByRole('button', { name: /Abrir menú/ }));
  screen.getByRole('link', { name: 'Alumnos' }).focus();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(document.body.style.overflow).toBe('auto');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: /Abrir menú/ }));
});

it('cierra el menú y libera el scroll al pasar a escritorio', () => {
  abrirMenu();
  consulta.matches = false;
  act(() => {
    consulta.dispatchEvent(new Event('change'));
  });
  expect(document.body.style.overflow).toBe('auto');
  expect(screen.queryByRole('button', { name: 'Cerrar navegación' })).toBeNull();
  consulta.matches = true;
  act(() => {
    consulta.dispatchEvent(new Event('change'));
  });
  expect(document.body.style.overflow).toBe('auto');
});

it('libera el scroll al navegar o desmontar el shell', () => {
  const vista = abrirMenu();
  fireEvent.click(screen.getByRole('link', { name: 'Alumnos' }));
  expect(document.body.style.overflow).toBe('auto');
  fireEvent.click(screen.getByRole('button', { name: /Abrir menú/ }));
  vista.unmount();
  expect(document.body.style.overflow).toBe('auto');
});

it('conserva nombres accesibles y enlaces permitidos para maestro al añadir iconos', () => {
  contexto.roles = ['MAESTRO'];
  abrirMenu();
  const navegacion = screen.getByRole('navigation', { name: 'Navegación principal' });
  expect(within(navegacion).getByRole('link', { name: 'Mis clases' })).toBeTruthy();
  expect(within(navegacion).queryByRole('link', { name: 'Finanzas' })).toBeNull();
  expect(within(navegacion).queryByRole('link', { name: 'Configuración' })).toBeNull();
  for (const enlace of within(navegacion).getAllByRole('link')) {
    const icono = enlace.querySelector('svg');
    expect(icono?.getAttribute('aria-hidden')).toBe('true');
    expect(icono?.getAttribute('focusable')).toBe('false');
    expect(enlace.textContent?.trim()).not.toBe('');
  }
});

it('mantiene las rutas académicas y financieras en una cuenta de varios roles', () => {
  contexto.roles = ['MAESTRO', 'FINANZAS'];
  abrirMenu();
  const navegacion = screen.getByRole('navigation', { name: 'Navegación principal' });
  expect(within(navegacion).getByRole('link', { name: 'Mis clases' })).toBeTruthy();
  expect(within(navegacion).getByRole('link', { name: 'Finanzas' })).toBeTruthy();
  expect(within(navegacion).queryByRole('link', { name: 'Docentes' })).toBeNull();
});

it('abre el menú como diálogo lateral y devuelve el foco al botón exterior', () => {
  abrirMenu();
  expect(screen.getByRole('dialog', { name: 'Menú principal' }).getAttribute('aria-modal')).toBe('true');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar menú' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar menú' }));
  expect(screen.queryByRole('dialog', { name: 'Menú principal' })).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir menú' }));
});

it('mantiene el foco dentro del cajón con Tab y Shift+Tab', () => {
  abrirMenu();
  const cerrar = screen.getByRole('button', { name: 'Cerrar menú' });
  const enlaces = within(screen.getByRole('navigation', { name: 'Navegación principal' })).getAllByRole('link');
  const ultimo = screen.getByRole('button', { name: 'Cerrar sesión' });
  cerrar.focus();
  fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(ultimo);
  ultimo.focus();
  fireEvent.keyDown(window, { key: 'Tab' });
  expect(document.activeElement).toBe(cerrar);
  expect(enlaces.length).toBeGreaterThan(0);
});

it('inactiva el contenido de fondo mientras el diálogo está abierto', () => {
  abrirMenu();
  const contenido = document.getElementById('contenido-principal')!;
  const salto = screen.getByText('Saltar al contenido principal');
  expect(contenido.inert).toBe(true);
  expect(salto.inert).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar menú' }));
  expect(contenido.inert).toBe(false);
  expect(salto.inert).toBe(false);
});

it('cierra Mi cuenta aun cuando ya está en esa ruta y enfoca el contenido', () => {
  render(
    <MemoryRouter initialEntries={['/cuenta']}>
      <Shell />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
  fireEvent.click(screen.getByRole('link', { name: 'Mi cuenta' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(document.getElementById('contenido-principal'));
  expect(document.body.style.overflow).toBe('auto');
});
it('muestra propósito de la sección', () => {
  render(
    <MemoryRouter initialEntries={['/finanzas']}>
      <Shell />
    </MemoryRouter>,
  );
  expect(screen.getByText('¿Para qué sirve esta sección?')).toBeTruthy();
  expect(screen.getByText(/Verifica alumno, monto y referencia/)).toBeTruthy();
});
it('avisa de desconexión y retira aviso al reconectar', () => {
  render(
    <MemoryRouter>
      <Shell />
    </MemoryRouter>,
  );
  const estado = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  act(() => window.dispatchEvent(new Event('offline')));
  expect(screen.getByRole('alert').textContent).toContain('sin conexión');
  estado.mockReturnValue(true);
  act(() => window.dispatchEvent(new Event('online')));
  expect(screen.queryByText(/Tu dispositivo está sin conexión/)).toBeNull();
  estado.mockRestore();
});

it('agrupa las tareas en orden y oculta áreas sin opciones permitidas', () => {
  contexto.roles = ['MAESTRO'];
  abrirMenu();
  const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
  expect(within(nav).queryByRole('group', { name: 'Control escolar' })).toBeNull();
  expect(within(within(nav).getByRole('group', { name: 'Docencia' })).getByRole('link', { name: 'Mis clases' })).toBeTruthy();
  expect(within(nav).getAllByRole('link')[0].getAttribute('href')).toBe('/');
});
