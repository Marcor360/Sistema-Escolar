import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource } from 'typeorm';
import { CrearDocenteDto } from '../docentes/docentes.dto';
import { CrearUsuarioDto } from '../usuarios/usuarios.dto';
import { ScopeService } from '../planteles/scope.service';
import { ImportacionesService } from './importaciones.service';

const servicio = new ImportacionesService(
  {} as DataSource, {} as ScopeService,
  { getOrThrow: () => 'clave-prueba-importacion' } as unknown as ConfigService,
);
const docente = {
  email: 'docente@example.test', nombre: 'Ana', apellidoPaterno: 'Prueba', apellidoMaterno: 'Ficticia',
  numEmpleado: 'D001', plantelIds: '1', cedulaProfesional: 'ABC123',
};
const personal = {
  email: 'personal@example.test', nombre: 'Beto', apellidoPaterno: 'Prueba', apellidoMaterno: 'Ficticia',
  roles: 'ADMINISTRATIVO', plantelIds: '1',
};

describe('Correo Microsoft 365 y GoDaddy en importaciones de docentes y personal', () => {
  it.each([
    ['DOCENTES', 'Microsoft 365', 'MICROSOFT365'],
    ['DOCENTES', 'GoDaddy', 'GODADDY'],
    ['PERSONAL', 'Microsoft 365', 'MICROSOFT365'],
    ['PERSONAL', 'GoDaddy', 'GODADDY'],
  ] as const)('%s acepta %s', async (tipo, elegido, esperado) => {
    const datos = servicio['preparar'](tipo, { ...(tipo === 'DOCENTES' ? docente : personal), correoProveedor: elegido });
    const dto = tipo === 'DOCENTES' ? plainToInstance(CrearDocenteDto, datos) : plainToInstance(CrearUsuarioDto, datos);
    expect(dto.correoProveedor).toBe(esperado);
    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
  });

  it.each(['DOCENTES', 'PERSONAL'] as const)('%s mantiene compatibilidad con CSV antiguo', async tipo => {
    const datos = servicio['preparar'](tipo, tipo === 'DOCENTES' ? docente : personal);
    const dto = tipo === 'DOCENTES' ? plainToInstance(CrearDocenteDto, datos) : plainToInstance(CrearUsuarioDto, datos);
    expect(dto.correoProveedor).toBeUndefined();
    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
  });

  it.each(['DOCENTES', 'PERSONAL'] as const)('%s rechaza proveedores desconocidos y columnas extrañas', async tipo => {
    const base = tipo === 'DOCENTES' ? docente : personal;
    const datos = servicio['preparar'](tipo, { ...base, correoProveedor: 'OTRO' });
    const dto = tipo === 'DOCENTES' ? plainToInstance(CrearDocenteDto, datos) : plainToInstance(CrearUsuarioDto, datos);
    expect((await validate(dto)).some(x => x.property === 'correoProveedor')).toBe(true);
    expect(() => servicio['preparar'](tipo, { ...base, secreto: 'invalido' })).toThrow('columnas no admitidas');
  });
});
