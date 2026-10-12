import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CrearAlumnoDto } from './alumnos.dto';

const valido = {
  email: 'ALUMNO@INSTITUCION.EDU.MX',
  nombre: 'María',
  apellidoPaterno: 'García',
  apellidoMaterno: 'López',
  matricula: '000123',
  plantelId: 1,
  curp: 'GODE561231HDFRRN09',
};

describe('CrearAlumnoDto: identidad institucional', () => {
  it('exige CURP de 18 caracteres en las altas', () => {
    for (const curp of [undefined, null, '', 'CURP', 'GODE561231HDFRRN0!']) {
      const dto = plainToInstance(CrearAlumnoDto, { ...valido, curp });
      expect(validateSync(dto).map((error) => error.property)).toContain('curp');
    }
  });

  it('acepta matrícula corta y normaliza el correo sin exigir contraseña manual', () => {
    const dto = plainToInstance(CrearAlumnoDto, valido);
    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.email).toBe('alumno@institucion.edu.mx');
    expect(dto.matricula).toBe('000123');
  });

  it('rechaza un campo password enviado manualmente si se usa whitelist estricta', () => {
    const dto = plainToInstance(CrearAlumnoDto, { ...valido, password: 'manual' });
    expect(validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).map((error) => error.property)).toContain('password');
  });
});
