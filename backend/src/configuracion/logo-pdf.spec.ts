import { BadRequestException } from '@nestjs/common';
import { nombreLogoPdf } from './configuracion.service';
import { ConfiguracionController } from './configuracion.controller';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../common/roles.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';

describe('variante imprimible del logo', () => {
  it('asocia únicamente marca-logo-UUID.webp al PNG correspondiente', () => {
    expect(nombreLogoPdf('/uploads/marca-logo-a1b2c3d4-1234-4567-89ab-d0123456789a.webp'))
      .toBe('marca-logo-a1b2c3d4-1234-4567-89ab-d0123456789a.png');
    expect(() => nombreLogoPdf('/uploads/../../private.png')).toThrow(BadRequestException);
    expect(() => nombreLogoPdf('/uploads/marca-pdf-temporal-otro.png')).toThrow(BadRequestException);
  });
  it('requiere JWT y rol exclusivo SUPERADMIN para guardar PNG', () => {
    const handler = ConfiguracionController.prototype.guardarLogoPdf;
    expect(Reflect.getMetadata(ROLES_KEY,handler)).toEqual(['SUPERADMIN']);
    expect(Reflect.getMetadata(GUARDS_METADATA,handler)).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
  });
});
