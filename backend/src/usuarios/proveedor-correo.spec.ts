import { proveedorCorreoPredeterminado } from '../entities/usuario.entity';
import { CrearPersonalDto, ActualizarUsuarioDto } from './usuarios.dto';
import { CrearAlumnoDto } from '../alumnos/alumnos.dto';
import { CrearDocenteDto } from '../docentes/docentes.dto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

describe('Política de proveedor del correo emisor', () => {
  it('selecciona Microsoft 365 para alumno y GoDaddy para todo el personal, incluidos docentes', () => {
    expect(proveedorCorreoPredeterminado(['ALUMNO'])).toBe('MICROSOFT365');
    for (const rol of ['MAESTRO', 'ADMINISTRATIVO', 'FINANZAS', 'SUPERADMIN']) {
      expect(proveedorCorreoPredeterminado([rol])).toBe('GODADDY');
    }
  });

  it('rechaza una preferencia no permitida y la selección nula', () => {
    expect(validateSync(plainToInstance(ActualizarUsuarioDto, { correoProveedor: 'OTRO' })).length).toBeGreaterThan(0);
    expect(validateSync(plainToInstance(ActualizarUsuarioDto, { correoProveedor: null })).length).toBeGreaterThan(0);
    expect(validateSync(plainToInstance(ActualizarUsuarioDto, { correoProveedor: 'MICROSOFT365' }))).toHaveLength(0);
  });

  it('usa el mismo contrato opcional en alumnos, docentes y personal', () => {
    const errores = [
      validateSync(plainToInstance(CrearAlumnoDto, { correoProveedor: 'OTRO' })),
      validateSync(plainToInstance(CrearDocenteDto, { correoProveedor: 'OTRO' })),
      validateSync(plainToInstance(CrearPersonalDto, { correoProveedor: 'OTRO' })),
    ];
    for (const validacion of errores) {
      expect(validacion.some((e) => e.property === 'correoProveedor')).toBe(true);
    }
  });
});
