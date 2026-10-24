import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource } from 'typeorm';
import { CrearAlumnoDto } from '../alumnos/alumnos.dto';
import { ScopeService } from '../planteles/scope.service';
import { ImportacionesService } from './importaciones.service';

const service = new ImportacionesService(
  {} as DataSource,
  {} as ScopeService,
  { getOrThrow: () => 'token-de-prueba-cifrado-importaciones' } as unknown as ConfigService,
);

const preparar = (fila: Record<string, string>) => service['preparar']('ALUMNOS', fila);

const alumno = {
  nombre: 'Rosa', apellidoPaterno: 'Pérez', matricula: '0000094',
  plantelId: '1', curp: 'AAAA010101MDFRRR09',
};

describe('Correo dual en importación de alumnos', () => {
  it('admite plantilla nueva con correo institucional y personal y proveedor obligatorio', async () => {
    const datos = preparar({ ...alumno, correoInstitucional: ' ESTUDIANTE@IUA.EDU.MX ', correoPersonal: 'personal@example.test', correoProveedor: 'Microsoft 365' });
    const dto = plainToInstance(CrearAlumnoDto, datos);
    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
    expect(dto.email).toBe('estudiante@iua.edu.mx');
    expect(dto.correoPersonal).toBe('personal@example.test');
    expect(dto.correoProveedor).toBe('MICROSOFT365');
    expect(datos).not.toHaveProperty('correoInstitucional');
  });

  it.each([
    ['Microsoft 365', 'MICROSOFT365'], ['GoDaddy', 'GODADDY'],
    ['MICROSOFT365', 'MICROSOFT365'], ['GODADDY', 'GODADDY'],
  ])('interpreta %s como %s', async (elegido, esperado) => {
    const dto = plainToInstance(CrearAlumnoDto, preparar({
      ...alumno, correoInstitucional: 'alumno@iua.edu.mx', correoProveedor: elegido,
    }));
    expect(dto.correoProveedor).toBe(esperado);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('mantiene compatibilidad con CSV anterior que usa email', async () => {
    const dto = plainToInstance(CrearAlumnoDto, preparar({ ...alumno, email: 'alumno@example.test', correoProveedor: 'GoDaddy' }));
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.email).toBe('alumno@example.test');
    expect(dto.correoProveedor).toBe('GODADDY');
  });

  it('rechaza encabezados email e institucional contradictorios', () => {
    expect(() => preparar({
      ...alumno, email: 'primero@example.test', correoInstitucional: 'otro@example.test',
    })).toThrow(BadRequestException);
  });

  it('no permite escoger un proveedor desconocido', async () => {
    const dto = plainToInstance(CrearAlumnoDto, preparar({
      ...alumno, correoInstitucional: 'alumno@example.test', correoProveedor: 'SERVIDOR_DESCONOCIDO',
    }));
    const errores = await validate(dto);
    expect(errores.some((e) => e.property === 'correoProveedor')).toBe(true);
  });

  it('exige correo institucional válido y valida correo personal si se proporciona', async () => {
    for (const fila of [
      { ...alumno, correoPersonal: 'personal@example.test', correoProveedor: 'GoDaddy' },
      { ...alumno, correoInstitucional: 'alumno@iua.edu.mx', correoPersonal: 'sin-arroba', correoProveedor: 'Microsoft 365' },
    ]) {
      const dto = plainToInstance(CrearAlumnoDto, preparar(fila));
      expect((await validate(dto)).some((e) => ['email', 'correoPersonal'].includes(e.property))).toBe(true);
    }
  });

  it('rechaza proveedor vacío aunque use CSV antiguo', () => {
    expect(() => preparar({ ...alumno, email: 'alumno@example.test' })).toThrow('Selecciona correoProveedor');
  });

  it('segundo nombre opcional sin afectar primer nombre obligatorio', async () => {
    const sinSegundo = plainToInstance(CrearAlumnoDto, preparar({
      ...alumno, correoInstitucional: 'alumno@example.test', correoProveedor: 'GoDaddy',
    }));
    const conSegundo = plainToInstance(CrearAlumnoDto, preparar({
      ...alumno, segundoNombre: 'Isabel', correoInstitucional: 'alumna@example.test', correoProveedor: 'Microsoft 365',
    }));
    expect(sinSegundo.nombre).toBe('Rosa');
    expect(conSegundo.nombre).toBe('Rosa Isabel');
    expect(await validate(sinSegundo)).toHaveLength(0);
    expect(await validate(conSegundo)).toHaveLength(0);
  });

  it('no admite columnas arbitrarias ni secretos agregados', () => {
    expect(() => preparar({ ...alumno, correoInstitucional: 'alumno@iua.edu.mx', password: 'no-guardar' }))
      .toThrow('columnas no admitidas');
  });
});
