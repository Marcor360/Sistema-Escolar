import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Usuario } from '../entities/usuario.entity';
import { Alumno } from '../entities/alumno.entity';
import { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import { Notificacion } from '../entities/notificacion.entity';
import { ScopeService } from '../planteles/scope.service';
import { CorreoMicrosoftService } from './correo-microsoft.service';
import { NotificacionesService } from './notificaciones.service';

function crearServicio(usuario: Partial<Usuario> | null, activo: boolean) {
  const usuarioRepo = { findOne: jest.fn().mockResolvedValue(usuario) };
  const graph = { habilitado: activo, enviar: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const servicio = new NotificacionesService(
    {} as Repository<Notificacion>, usuarioRepo as unknown as Repository<Usuario>,
    {} as Repository<Alumno>, {} as Repository<UsuarioPlantel>,
    {} as ScopeService, config as unknown as ConfigService,
    undefined, graph as unknown as CorreoMicrosoftService,
  );
  return { servicio, graph, usuarioRepo };
}

describe('Selección del proveedor de correo por usuario', () => {
  it('usa Graph si el alumno lo tiene marcado y está habilitado', async () => {
    const { servicio, graph } = crearServicio({ correoProveedor: 'MICROSOFT365' }, true);
    await expect(servicio.enviarEmail('alumno@ejemplo.test', 'Acceso', '<p>Hola</p>'))
      .resolves.toEqual({ simulado: false });
    expect(graph.enviar).toHaveBeenCalledWith(
      'alumno@ejemplo.test', 'Acceso', '<p>Hola</p>', expect.any(String), undefined,
    );
  });

  it('mantiene GoDaddy para administrativos, docentes y correos externos sin cuenta', async () => {
    for (const usuario of [{ correoProveedor: 'GODADDY' as const }, null]) {
      const { servicio, graph } = crearServicio(usuario, true);
      await expect(servicio.enviarEmail('personal@ejemplo.test', 'Aviso', 'Hola'))
        .resolves.toEqual({ simulado: true });
      expect(graph.enviar).not.toHaveBeenCalled();
    }
  });

  it('nunca cambia silenciosamente a GoDaddy si Microsoft está deshabilitado', async () => {
    const { servicio, graph } = crearServicio({ correoProveedor: 'MICROSOFT365' }, false);
    await expect(servicio.enviarEmail('alumno@ejemplo.test', 'Aviso', 'Hola'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(graph.enviar).not.toHaveBeenCalled();
  });

  it('conserva la preferencia explícita del docente aunque su rol sugiera otro proveedor', async () => {
    const { servicio, graph } = crearServicio({
      correoProveedor: 'MICROSOFT365',
      roles: [{ clave: 'MAESTRO' }] as unknown as Usuario['roles'],
    }, true);
    await servicio.enviarEmail('docente@ejemplo.test', 'Aviso', 'Hola', 'referencia-segura');
    expect(graph.enviar).toHaveBeenCalledWith(
      'docente@ejemplo.test', 'Aviso', 'Hola', expect.any(String), 'referencia-segura',
    );
  });
});

describe('Configuración de Microsoft Graph', () => {
  it('no exige credenciales cuando el proveedor está deshabilitado', () => {
    expect(new CorreoMicrosoftService({ get: () => undefined } as unknown as ConfigService).habilitado).toBe(false);
  });
  it('falla el arranque cuando se habilita sin certificado privado ni configuración completa', () => {
    const valores: Record<string, string> = { GRAPH_CORREO_HABILITADO: 'true' };
    expect(() => new CorreoMicrosoftService({
      get: (clave: string) => valores[clave],
    } as unknown as ConfigService)).toThrow('configuración de Microsoft Graph está incompleta');
  });
});
