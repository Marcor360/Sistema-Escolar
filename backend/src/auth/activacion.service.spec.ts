import { ActivacionService } from './activacion.service';

describe('ActivacionService.solicitar', () => {
  it('espera persistencia, devuelve una respuesta genérica y no envía SMTP desde HTTP', async () => {
    let confirmar!: () => void;
    const commit = new Promise<void>(r => { confirmar = r; });
    const outbox = { solicitar: jest.fn().mockReturnValue(commit) };
    const servicio = new ActivacionService({} as never, outbox as never);
    let respondio = false;
    const solicitud = servicio.solicitar('titular@example.test').then(r => { respondio = true; return r; });
    await Promise.resolve();
    expect(respondio).toBe(false);
    confirmar();
    const respuesta = await solicitud;
    expect(outbox.solicitar).toHaveBeenCalledWith('titular@example.test', 'ACTIVACION');
    expect(respuesta).toEqual(await servicio.solicitar('inexistente@example.test'));
    expect(JSON.stringify(respuesta)).not.toMatch(/[a-f0-9]{64}/);
  });
});
