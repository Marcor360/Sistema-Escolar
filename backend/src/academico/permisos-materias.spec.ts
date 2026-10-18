import 'reflect-metadata';
import { ROLES_KEY } from '../common/roles.decorator';
import { AcademicoController } from './academico.controller';

describe('permisos de Materias', () => {
  it('reserva la desactivación a SUPERADMIN en la API', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AcademicoController.prototype.desactivarMateria))
      .toEqual(['SUPERADMIN']);
  });
});
