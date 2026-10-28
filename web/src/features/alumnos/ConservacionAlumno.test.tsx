import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../../api/client';
import { ConservacionAlumno } from './ConservacionAlumno';
const alConciliar = vi.fn();
const montar = (legado = true) =>
  render(
    <ConservacionAlumno
      alumnoId={8}
      egresoLegado={legado}
      ciclos={[{ id: 3, nombre: 'Ciclo verificado' }]}
      alConciliar={alConciliar}
    />,
  );
beforeEach(() => {
  alConciliar.mockReset();
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('revisa conservación solo por petición del usuario, sin ninguna llamada de eliminación', async () => {
  const get = vi
    .spyOn(api, 'get')
    .mockResolvedValue({
      data: {
        eliminacionHabilitada: false,
        egresoConciliado: false,
        ciclos: [{ cicloId: 3, nombre: 'Ciclo verificado', estado: 'CERRADO', adjuntos: 2 }],
        bloqueos: [],
        aviso: '',
      },
    });
  const borrar = vi.spyOn(api, 'delete');
  montar(false);
  expect(get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Revisar conservación de adjuntos'));
  expect(await screen.findByText(/Eliminación automática deshabilitada/)).toBeTruthy();
  expect(screen.getByText(/Ciclo verificado: 2 adjuntos/)).toBeTruthy();
  expect(borrar).not.toHaveBeenCalled();
});
it('no inventa datos y exige confirmación antes de conciliar', async () => {
  const post = vi
    .spyOn(api, 'post')
    .mockResolvedValue({
      data: {
        cicloId: 3,
        fechaEgreso: '2020-07-15T18:00:00Z',
        archivarDesde: '2025-07-15T18:00:00Z',
        estadoArchivo: 'VIGENTE',
      },
    });
  montar();
  expect((screen.getByLabelText('Fecha documentada de egreso') as HTMLInputElement).value).toBe('');
  fireEvent.change(screen.getByLabelText('Ciclo documentado'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('CURP verificada'), { target: { value: 'LOPA900101HDFRRL09' } });
  fireEvent.change(screen.getByLabelText('Fecha documentada de egreso'), { target: { value: '2020-07-15' } });
  fireEvent.change(screen.getByLabelText('Referencia del documento de origen'), { target: { value: 'Acta QA-2020' } });
  fireEvent.click(screen.getByText('Verificar y conciliar egreso'));
  expect(post).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  expect(post).toHaveBeenCalledWith(
    '/alumnos/8/egreso/conciliacion',
    expect.objectContaining({
      cicloId: 3,
      curp: 'LOPA900101HDFRRL09',
      confirmado: true,
      referenciaDocumental: 'Acta QA-2020',
    }),
  );
  await waitFor(() => expect(alConciliar).toHaveBeenCalledTimes(1));
});
it('muestra un rechazo del servidor sin marcar el egreso como conciliado', async () => {
  vi.spyOn(api, 'get').mockRejectedValue(new Error('Sin acceso'));
  montar(false);
  fireEvent.click(screen.getByText('Revisar conservación de adjuntos'));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(alConciliar).not.toHaveBeenCalled();
});
