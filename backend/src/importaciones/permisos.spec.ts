import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ImportacionesService } from './importaciones.service';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';
import { TipoImportacion } from './importaciones.dto';

describe('Matriz de autorización de importaciones', () => {
  const service = new ImportacionesService(
    {} as DataSource,
    {} as ScopeService,
    { getOrThrow: () => 'test-secret-mas-de-32-caracteres-para-preview' } as unknown as ConfigService,
  );
  const usuario = (rol: string): JwtUser => ({
    sub: 12, email: 'actor@example.test', nombre: 'Actor', roles: [rol],
  });
  it.each([
    ['FINANZAS', 'ALUMNOS', true],
    ['FINANZAS', 'DOCENTES', false],
    ['FINANZAS', 'INSCRIPCIONES', false],
    ['FINANZAS', 'PERSONAL', false],
    ['ADMINISTRATIVO', 'ALUMNOS', false],
    ['ADMINISTRATIVO', 'DOCENTES', true],
    ['ADMINISTRATIVO', 'INSCRIPCIONES', true],
    ['ADMINISTRATIVO', 'PERSONAL', false],
    ['SUPERADMIN', 'ALUMNOS', true],
    ['SUPERADMIN', 'DOCENTES', true],
    ['SUPERADMIN', 'INSCRIPCIONES', true],
    ['SUPERADMIN', 'PERSONAL', true],
    ['MAESTRO', 'ALUMNOS', false],
  ])('%s puede importar %s: %s', (rol, tipo, permitido) => {
    const verificar = () => service.validarTipo(tipo as TipoImportacion, usuario(rol as string));
    if (permitido) expect(verificar).not.toThrow();
    else expect(verificar).toThrow();
  });
  it('rechaza capturas de calificaciones fuera de su flujo', () => {
    expect(() => service.validarTipo('CALIFICACIONES', usuario('SUPERADMIN'))).toThrow('Calificaciones');
  });
});
