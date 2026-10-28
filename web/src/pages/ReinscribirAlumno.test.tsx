import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../api/client';
import ReinscribirAlumno from './ReinscribirAlumno';
const permisos = vi.hoisted(() => ({ roles: ['ADMINISTRATIVO'] }));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    tieneRol: (...roles: string[]) =>
      permisos.roles.includes('SUPERADMIN') || roles.some((r) => permisos.roles.includes(r)),
  }),
}));
vi.mock('../components/useConfirmacion', () => ({
  useConfirmacion: () => ({ solicitar: async () => true, elemento: null }),
}));
vi.mock('../components/SelectorBuscable', () => ({
  SelectorBuscable: ({
    etiqueta,
    valor,
    cambiar,
  }: {
    etiqueta: string;
    valor: string;
    cambiar: (v: string) => void;
  }) => (
    <label>
      {etiqueta}
      <select value={valor} onChange={(e) => cambiar(e.target.value)}>
        <option value="">Selecciona</option>
        <option value={etiqueta.includes('Grupo') ? '88' : '5'}>Alumno o grupo explícito</option>
      </select>
    </label>
  ),
}));
vi.mock('../components/ContextoAcademicoSelector', () => ({
  CONTEXTO_VACIO: { nivelId: '', carreraId: '', periodoAcademicoId: '' },
  ContextoAcademicoSelector: ({
    cambiar,
  }: {
    cambiar: (v: { nivelId: string; carreraId: string; periodoAcademicoId: string }) => void;
  }) => (
    <button type="button" onClick={() => cambiar({ nivelId: '1', carreraId: '2', periodoAcademicoId: '4' })}>
      Seleccionar periodo cuarto
    </button>
  ),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const autorizacion = {
  id: 9,
  cotizacion: 'c'.repeat(64),
  total: 1200,
  financieroId: 33,
  venceAt: '2030-01-01T00:00:00Z',
  conceptos: [{ conceptoId: 7, nombre: 'Colegiatura', monto: 1200, descuento: 0 }],
  destino: { periodo: 'Cuarto cuatrimestre', tipo: 'CUATRIMESTRAL', numero: 4, ciclo: '2026', grupoId: 88 },
};
async function preparar(roles = ['ADMINISTRATIVO']) {
  permisos.roles = roles;
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data:
      String(url) === '/planteles/mios'
        ? [{ id: 1, nombre: 'Centro' }]
        : String(url) === '/academico/ciclos'
          ? [
              {
                id: 1,
                nombre: '2026',
                clave: '2026',
                estado: 'ACTIVO',
                fechaInicio: '2026-01-01',
                fechaFin: '2026-12-31',
              },
            ]
          : String(url) === '/finanzas/conceptos'
            ? [{ id: 7, nombre: 'Colegiatura', tipo: 'COLEGIATURA', montoBase: 1200, activo: true }]
            : String(url).includes('/autorizaciones/')
              ? [autorizacion]
              : String(url).includes('/historial')
                ? {
                    datos: [
                      { id: 12, estado: 'PENDIENTE', origenInscripcionId: 3, periodoAcademicoId: 4, total: 1200 },
                    ],
                  }
                : {
                    alumno: { id: 5, matricula: 'RP5', nombre: 'María José Prueba', plantelId: 1 },
                    origen: {
                      inscripcionId: 3,
                      grupo: 'Origen',
                      cicloId: 1,
                      nivelId: 1,
                      carreraId: 2,
                      periodoAcademicoId: 3,
                      periodo: 'Tercero',
                      tipo: 'CUATRIMESTRAL',
                      numero: 3,
                      turno: 'MATUTINO',
                      fechaFin: '2026-12-31',
                    },
                    advertencia: 'El historial se conserva',
                  },
  }));
  render(
    <MemoryRouter>
      <ReinscribirAlumno />
    </MemoryRouter>,
  );
  await screen.findByText('Centro');
  fireEvent.change(screen.getByLabelText('Plantel'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Alumno (matrícula o nombre completo)'), { target: { value: '5' } });
  await screen.findByText('María José Prueba · RP5');
}
it('Control Escolar confirma una autorización congelada y reutiliza la misma idempotencia al reintentar', async () => {
  const post = vi
    .spyOn(api, 'post')
    .mockRejectedValueOnce(new Error('Sin conexión'))
    .mockResolvedValueOnce({ data: { id: 44, estado: 'CONFIRMADA', grupoId: 88, total: 1200, conceptos: [] } });
  await preparar();
  fireEvent.click(screen.getByRole('radio'));
  expect(screen.getByText(/Destino autorizado: Cuarto cuatrimestre/)).toBeTruthy();
  fireEvent.click(screen.getByText('Confirmar reinscripción y cargos'));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByText('Confirmar reinscripción y cargos'));
  await screen.findByText('Reinscripción registrada');
  expect(post.mock.calls[0][1]).toEqual(post.mock.calls[1][1]);
  expect(post).toHaveBeenLastCalledWith('/cartera/reinscripciones/confirmar', {
    autorizacionId: 9,
    cotizacion: 'c'.repeat(64),
    idempotencia: expect.any(String),
    confirmado: true,
  });
  expect(screen.getByText(/no registra pagos/)).toBeTruthy();
});
it('Finanzas autoriza el precio y calendario pero no recibe la acción de confirmar la inscripción', async () => {
  const post = vi
    .spyOn(api, 'post')
    .mockResolvedValueOnce({ data: autorizacion })
    .mockResolvedValueOnce({ data: { ...autorizacion, autorizacionId: 9 } });
  await preparar(['FINANZAS']);
  fireEvent.change(screen.getByLabelText('Ciclo de destino'), { target: { value: '1' } });
  fireEvent.click(screen.getByText('Seleccionar periodo cuarto'));
  fireEvent.click(screen.getByLabelText(/Colegiatura —/));
  fireEvent.change(screen.getByLabelText('Mes de cobro'), { target: { value: '2026-05' } });
  fireEvent.change(screen.getByLabelText('Fecha de vencimiento'), { target: { value: '2026-05-15' } });
  fireEvent.click(screen.getByText('Previsualizar reinscripción'));
  await screen.findByText('Autorizar precio y calendario como Finanzas');
  fireEvent.click(screen.getByText('Autorizar precio y calendario como Finanzas'));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/cartera/reinscripciones/autorizar-precio',
      expect.objectContaining({ cotizacion: 'c'.repeat(64), periodoAcademicoId: 4 }),
    ),
  );
  expect(screen.queryByText('Confirmar reinscripción y cargos')).toBeNull();
});
it('permite anular solo una solicitud pendiente con motivo y conserva su historial', async () => {
  vi.spyOn(api, 'post').mockResolvedValue({
    data: { id: 12, estado: 'ANULADA', origenInscripcionId: 3, periodoAcademicoId: 4, total: 1200 },
  });
  await preparar();
  fireEvent.click(screen.getByText('Consultar historial de reinscripciones'));
  await screen.findByText('Operación #12 · PENDIENTE');
  expect((screen.getByText('Anular solicitud #12') as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Motivo para anular una solicitud pendiente'), {
    target: { value: 'Posponer solicitud por acuerdo documentado' },
  });
  fireEvent.click(screen.getByText('Anular solicitud #12'));
  await screen.findByText('Operación #12 · ANULADA');
  expect(api.post).toHaveBeenCalledWith('/cartera/reinscripciones/operaciones/12/anular', {
    motivo: 'Posponer solicitud por acuerdo documentado',
    confirmado: true,
  });
});
