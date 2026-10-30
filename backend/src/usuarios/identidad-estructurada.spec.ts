import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CrearUsuarioDto } from './usuarios.dto';
import { CrearAlumnoDto } from '../alumnos/alumnos.dto';
import { CrearDocenteDto } from '../docentes/docentes.dto';
import { Usuario } from '../entities/usuario.entity';

describe('Campos de identidad', () => {
  const casos = [CrearUsuarioDto, CrearAlumnoDto, CrearDocenteDto] as const;
  const propiedadesInvalidas = (tipo: new () => object, datos: Record<string, unknown>) =>
    validateSync(plainToInstance(tipo, datos)).map(e => e.property);
  it.each(casos)('permite segundo nombre omitido o vacío', (tipo) => {
    expect(propiedadesInvalidas(tipo, { nombre: 'Ana', apellidoPaterno: 'López', apellidoMaterno: 'García', segundoNombre: '' })).not.toContain('segundoNombre');
  });
  it.each(casos)('rechaza ambos apellidos vacíos al crear', (tipo) => {
    const invalidos = propiedadesInvalidas(tipo, { nombre: 'Ana', apellidoPaterno: ' ', apellidoMaterno: ' ' });
    expect(invalidos).toContain('apellidoPaterno');
    expect(invalidos).toContain('apellidoMaterno');
  });
  it('mantiene íntegros los nombres anteriores', () => {
    const usuario = Object.assign(new Usuario(), { nombre: 'María del Carmen', segundoNombre: null as string | null, apellidoPaterno: 'De la Cruz', apellidoMaterno: 'García' });
    expect(usuario.nombreCompleto).toBe('María del Carmen De la Cruz García');
    usuario.segundoNombre = 'Elena';
    expect(usuario.nombreCompleto).toBe('María del Carmen Elena De la Cruz García');
  });
});
