import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ImportacionesService } from './importaciones.service';
import { ScopeService } from '../planteles/scope.service';

const service = new ImportacionesService(
  {} as DataSource, {} as ScopeService,
  { getOrThrow: () => 'clave-privada-de-prueba-para-importacion-parcial' } as unknown as ConfigService,
);
const alumno = (matricula: string, correo: string, proveedor = 'Microsoft 365') => ({
  matricula, correoInstitucional: correo, correoProveedor: proveedor,
  nombre: 'Rosa', apellidoPaterno: 'Prueba', curp: 'AAAA010101MDFRRR09', plantelId: '1',
});
function catalogos() {
  return {
    permitidos: null, planteles: new Map([[1, { activo: true }]]),
    grupos: new Map(), alumnos: new Map(), emails: new Set(['existente@iua.edu.mx']),
    identificadores: new Set(['EXISTE']), inscripciones: new Set(), previas: new Map(), roles: new Map(),
  } as unknown as Parameters<ImportacionesService['evaluarAlumnos']>[1];
}
describe('Carga parcial de alumnos', () => {
  it('acepta solo los nuevos, omite existentes e identifica los que deben corregirse', async () => {
    const filas = [
      alumno('NUEVO001', 'nuevo@iua.edu.mx'),
      alumno('EXISTE', 'otro@iua.edu.mx'),
      alumno('NUEVO002', 'existente@iua.edu.mx'),
      alumno('INVALIDO', 'correo-mal-formado'),
      alumno('NUEVO001', 'nuevo@iua.edu.mx'),
      alumno('NUEVO003', 'otro3@iua.edu.mx', ''),
    ];
    const resultado = await service['evaluarAlumnos'](filas, catalogos());
    expect(resultado.validas).toHaveLength(1);
    expect(resultado.duplicados.map((f) => f.fila)).toEqual([3, 4, 6]);
    expect(resultado.errores.map((f) => f.fila)).toEqual([5, 7]);
  });
  it('reprocesar el mismo archivo no produce nuevos registros', async () => {
    const filas = [alumno('NUEVO001', 'nuevo@iua.edu.mx')];
    const c = catalogos();
    c.emails.add('nuevo@iua.edu.mx');
    c.identificadores.add('NUEVO001');
    const resultado = await service['evaluarAlumnos'](filas, c);
    expect(resultado.validas).toHaveLength(0);
    expect(resultado.duplicados).toHaveLength(1);
    expect(resultado.errores).toHaveLength(0);
  });
});
