import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CrearUsuarioDto } from './usuarios.dto';
import { CrearAlumnoDto } from '../alumnos/alumnos.dto';
import { CrearDocenteDto } from '../docentes/docentes.dto';
import { Usuario } from '../entities/usuario.entity';

describe('Campos de identidad', () => {
  const casos = [CrearUsuarioDto, CrearAlumnoDto, CrearDocenteDto] as const;
  it.each(casos)('permite segundo nombre omitido o vacío', (tipo) => {
    const instancia = plainToInstance(tipo, { nombre: 'Ana', apellidoPaterno: 'López', apellidoMaterno: 'García', segundoNombre: '' });
    expect(validateSync(instancia).map(e => e.property)).not.toContain('segundoNombre');
  });
  it.each(casos)('rechaza ambos apellidos vacíos al crear', (tipo) => {
    const instancia = plainToInstance(tipo, { nombre: 'Ana', apellidoPaterno: ' ', apellidoMaterno: ' ' });
    const invalidos = validateSync(instancia).map(e => e.property);
    expect(invalidos).toContain('apellidoPaterno');
    expect(invalidos).toContain('apellidoMaterno');
  });
  it('mantiene íntegros los nombres anteriores', () => {
    const usuario = Object.assign(new Usuario(), { nombre: 'María del Carmen', segundoNombre: null, apellidoPaterno: 'De la Cruz', apellidoMaterno: 'García' });
    expect(usuario.nombreCompleto).toBe('María del Carmen De la Cruz García');
    usuario.segundoNombre = 'Elena';
    expect(usuario.nombreCompleto).toBe('María del Carmen Elena De la Cruz García');
  });
});
