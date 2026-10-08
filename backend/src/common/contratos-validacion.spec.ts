import 'reflect-metadata';
import { EventoDto } from '../calendario/calendario.dto';
import { ActualizarMarcaDto } from '../configuracion/configuracion.dto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ActualizarMateriaDto, ActualizarCicloDto, CicloDto } from '../academico/academico.dto';
import { ActualizarConceptoDto, ConceptoDto } from '../finanzas/finanzas.dto';
import { ActualizarUsuarioDto } from '../usuarios/usuarios.dto';
import { ActualizarAlumnoDto } from '../alumnos/alumnos.dto';
import { ActualizarActividadDto } from '../actividades/actividades.dto';
it('rechaza null en campos no anulables sin rechazar omisiones ni la limpieza de fechas nullable', () => {
  for (const [Dto, campos] of [[ActualizarMateriaDto,['clave','nombre','creditos']], [ActualizarCicloDto,['nombre','fechaInicio','fechaFin']], [ActualizarConceptoDto,['clave','nombre','activo','montoBase']], [ActualizarUsuarioDto,['nombre','activo','password','roles']], [ActualizarActividadDto,['titulo','parcial','ponderacion']]] as const) {
    expect(validateSync(plainToInstance<object, Record<string, unknown>>(Dto,{}))).toHaveLength(0);
    for (const campo of campos) expect(validateSync(plainToInstance<object, Record<string, unknown>>(Dto,{ [campo]: null })).map((e) => e.property)).toContain(campo);
  }
  expect(validateSync(plainToInstance(ActualizarAlumnoDto,{ fechaNacimiento: null }))).toHaveLength(0);
  expect(validateSync(plainToInstance(ActualizarActividadDto,{ fechaEntrega: null }))).toHaveLength(0);
});
it('el ciclo exige días civiles válidos, sin aceptar instantes truncados por DATE', () => {
  for (const fecha of ['2027-02-29','2027-01-01T23:00:00Z']) expect(validateSync(plainToInstance(CicloDto,{ clave: 'C', nombre: 'Ciclo', fechaInicio: fecha, fechaFin: '2027-12-31' })).map((e) => e.property)).toContain('fechaInicio');
});
it('los conceptos financieros respetan longitud y precisión física sin redondear entrada inválida', () => {
  for (const datos of [{ clave: 'X'.repeat(21) }, { nombre: 'X'.repeat(121) }, { montoBase: 1.234 }, { montoBase: 10000000000 }]) expect(validateSync(plainToInstance(ConceptoDto,{ clave: 'COL',nombre: 'Colegiatura',tipo: 'COLEGIATURA',montoBase: 1200,...datos })).length).toBeGreaterThan(0);
});
it('actividad y entrega no redondean silenciosamente más de dos decimales', () => {
  expect(validateSync(plainToInstance(ActualizarActividadDto,{ ponderacion: 12.345 })).map((e) => e.property)).toContain('ponderacion');
});

it('nombre institucional y evento no aceptan espacios como contenido', () => {
  expect(validateSync(plainToInstance(ActualizarMarcaDto,{ nombreInstitucion: '  ',nombreCorto: 'SE',colorPrimario: '#14343B',colorAcento: '#C79A3C' })).map((e) => e.property)).toContain('nombreInstitucion');
  expect(validateSync(plainToInstance(EventoDto,{ titulo: '  ',fechaInicio: '2027-01-01T12:00:00Z' })).map((e) => e.property)).toContain('titulo');
});
