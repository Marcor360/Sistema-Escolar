import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AtencionBoleta } from './AtencionBoleta';
import { api } from '../api/client';
vi.mock('./useConfirmacion', () => ({ useConfirmacion: () => ({ solicitar: async () => true, elemento: null }) }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('asigna responsable y exige explicar la atención sin resolver directamente una revisión pendiente', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 2 } }),
    guardado = vi.fn();
  render(
    <AtencionBoleta
      inscripcionId={8}
      revisionId={4}
      versionHash={'a'.repeat(64)}
      responsables={[{ id: 3, nombre: 'Docente de la materia' }]}
      atencion={{ estado: 'PENDIENTE', vigente: true, eventos: [] }}
      alGuardar={guardado}
    />,
  );
  expect(screen.queryByRole('option', { name: 'Resuelta' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Responsable'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Respuesta o motivo del cambio'), {
    target: { value: 'Revisaremos los criterios con la familia.' },
  });
  fireEvent.submit(screen.getByRole('button', { name: 'Guardar atención' }).closest('form')!);
  await waitFor(() => expect(guardado).toHaveBeenCalledOnce());
  expect(post).toHaveBeenCalledWith(
    '/boletas/inscripciones/8/atencion',
    expect.objectContaining({
      respuestaId: 4,
      responsableId: 3,
      estado: 'EN_ATENCION',
      comentario: 'Revisaremos los criterios con la familia.',
    }),
  );
});
it('conserva la clave al reintentar un fallo de red y permite resolver una revisión en atención', async () => {
  const post = vi
    .spyOn(api, 'post')
    .mockRejectedValueOnce(new Error('red'))
    .mockResolvedValue({ data: { id: 3 } });
  render(
    <AtencionBoleta
      inscripcionId={8}
      revisionId={4}
      versionHash={'a'.repeat(64)}
      responsables={[{ id: 3, nombre: 'Responsable QA' }]}
      atencion={{
        estado: 'EN_ATENCION',
        vigente: true,
        eventos: [
          {
            id: 1,
            estado: 'EN_ATENCION',
            responsableId: 3,
            responsable: 'Responsable QA',
            actor: 'Admin QA',
            comentario: 'Se revisará.',
            fecha: '2026-10-29T12:00:00Z',
          },
        ],
      }}
      alGuardar={vi.fn()}
    />,
  );
  expect((screen.getByLabelText('Estado de atención') as HTMLSelectElement).value).toBe('RESUELTA');
  fireEvent.change(screen.getByLabelText('Respuesta o motivo del cambio'), {
    target: { value: 'Se revisaron los criterios con el tutor.' },
  });
  const form = screen.getByRole('button', { name: 'Guardar atención' }).closest('form')!;
  fireEvent.submit(form);
  await screen.findByRole('alert');
  fireEvent.submit(form);
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  expect(post.mock.calls[0][1]).toEqual(post.mock.calls[1][1]);
});
