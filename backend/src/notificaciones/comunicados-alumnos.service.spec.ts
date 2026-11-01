import { ForbiddenException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { ScopeService } from '../planteles/scope.service';
import { stub } from '../test-utils/stub';
import { ComunicadosAlumnosService } from './comunicados-alumnos.service';

const actor = { sub: 1, nombre: 'Operador', email: 'admin@example.test', roles: ['ADMINISTRATIVO'], portal: 'WEB' as const };

describe('ComunicadosAlumnosService permisos e idempotencia', () => {
  it('rechaza un actor móvil antes de acceder a datos', async () => {
    const service = new ComunicadosAlumnosService(stub<DataSource>({}), stub<ScopeService>({}));
    await expect(service.crear({ plantelId: 2, titulo: 'Aviso', mensaje: 'Mensaje' },
      { ...actor, portal: 'MOVIL' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza un plantel no autorizado antes de crear borrador', async () => {
    const scope = { validarGestion: jest.fn().mockRejectedValue(new ForbiddenException('Plantel no autorizado')) };
    const ds = { getRepository: jest.fn() };
    const service = new ComunicadosAlumnosService(stub<DataSource>(ds), stub<ScopeService>(scope));
    await expect(service.crear({ plantelId: 3, titulo: 'Aviso', mensaje: 'Mensaje' }, actor))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(ds.getRepository).not.toHaveBeenCalled();
  });

  it('repetir publicación enviada no crea notificaciones duplicadas', async () => {
    const comunicado = { id: 4, plantelId: 2, estado: 'ENVIADO', destinatarios: 17 };
    const repositorio = { findOneBy: jest.fn().mockResolvedValue(comunicado), findOne: jest.fn().mockResolvedValue(comunicado) };
    const manager = { getRepository: jest.fn(() => repositorio) };
    const ds = {
      getRepository: jest.fn(() => repositorio),
      transaction: jest.fn(async (callback: (arg: unknown) => Promise<unknown>) => callback(manager)),
    };
    const scope = { validarGestion: jest.fn().mockResolvedValue(undefined) };
    const service = new ComunicadosAlumnosService(stub<DataSource>(ds), stub<ScopeService>(scope));
    await expect(service.publicar(4, actor)).resolves.toEqual({ id: 4, enviadas: 17, repetido: true });
    expect(manager.getRepository).toHaveBeenCalledTimes(1);
  });
});
