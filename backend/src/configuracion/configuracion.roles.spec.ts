import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ConfiguracionController } from './configuracion.controller';
import { ROLES_KEY } from '../common/roles.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';

describe('configuración institucional', () => {
  it.each(['actualizarMarca','actualizarOpciones','guardarLogo','quitarLogo'] as const)(
    'protege %s exclusivamente con SUPERADMIN y con autenticación',
    (accion) => {
      const handler = ConfiguracionController.prototype[accion];
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['SUPERADMIN']);
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    },
  );
});
