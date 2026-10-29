import { BoletaRespuesta } from '../entities/boleta-respuesta.entity';
import { DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { FormatosEscolaresService } from './formatos-escolares.service';
import { ReportesService } from './reportes.service';
import { AlumnosService } from '../alumnos/alumnos.service';
import { ScopeService } from '../planteles/scope.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { JwtUser } from '../common/current-user.decorator';
import { Alumno } from '../entities/alumno.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { GrupoMateria } from '../entities/grupo-materia.entity';
import { Calificacion } from '../entities/calificacion.entity';
import { PeriodoCalificacion } from '../entities/periodo-calificacion.entity';
const estudiante:JwtUser={sub:7,email:'qa@example.invalid',nombre:'QA',roles:['ALUMNO']};
const administrativo:JwtUser={...estudiante,roles:['ADMINISTRATIVO']};
function preparar(cerrado=true,completo=true){
 const usuario={nombre:'QA',apellidoPaterno:'Prueba',apellidoMaterno:'Escolar',nombreCompleto:'QA Prueba Escolar'};
 const alumno={id:1,matricula:'QA001',usuario};
 const grupo={id:5,plantelId:2,nombre:'QA',ciclo:{clave:'2026-01'},plantel:{nombre:'Plantel QA'},carrera:{nombre:'Derecho'},periodoAcademico:{nombre:'Primero'}};
 const gm={id:3,grupoId:5,grupo,materia:{clave:'0311',nombre:'Materia QA',creditos:7},docente:{usuario}};
 const notas=[1,2,3].filter(p=>completo||p!==3).map(parcial=>({alumnoId:1,grupoMateriaId:3,parcial,calificacion:parcial===1?0:90,observaciones:''}));
 const periodos=[1,2,3].map(parcial=>({grupoMateriaId:3,parcial,estatus:cerrado?'CERRADO':'ABIERTO'}));
 const alumnoRepo={findOneBy:jest.fn().mockResolvedValue(alumno)};
 const inscripciones={find:jest.fn().mockResolvedValue([{id:8,alumnoId:1,alumno,grupo}])};
 const clases={find:jest.fn().mockResolvedValue([gm])};
 const ds={getRepository:jest.fn((entity:unknown)=>{
  if(entity===BoletaRespuesta)return {find:jest.fn().mockResolvedValue([])};
  if(entity===Alumno)return alumnoRepo;if(entity===Inscripcion)return inscripciones;if(entity===GrupoMateria)return clases;
  if(entity===Calificacion)return {find:jest.fn().mockImplementation(({where}:{where:{parcial?:number}})=>Promise.resolve(notas.filter(n=>where.parcial===undefined||n.parcial===where.parcial)))};
  if(entity===PeriodoCalificacion)return {find:jest.fn().mockResolvedValue(periodos),findOneBy:jest.fn().mockResolvedValue(periodos[0])};throw new Error('Repositorio inesperado');
 })};
 const reportes={validarAccesoAClase:jest.fn().mockResolvedValue(gm)},scope={validarGestion:jest.fn().mockResolvedValue(undefined)};
 const service=new FormatosEscolaresService(ds as unknown as DataSource,reportes as unknown as ReportesService,
 {obtenerPorUsuario:jest.fn().mockResolvedValue(alumno)} as unknown as AlumnosService,scope as unknown as ScopeService,
 {obtener:jest.fn().mockResolvedValue({nombreInstitucion:'Institución QA'})} as unknown as ConfiguracionService);
 return {service,ds,scope,reportes,inscripciones,periodos};
}
describe('Formatos escolares privados',()=>{
 it('rechaza al alumno que solicita otra identidad antes de consultar expedientes',async()=>{
  const {service,ds}=preparar();await expect(service.boleta(2,estudiante,8)).rejects.toThrow('otro alumno');expect(ds.getRepository).not.toHaveBeenCalled();
 });
 it('oculta las notas de la boleta al alumno antes de cerrar y bloquea Excel y PDF',async()=>{
  const {service}=preparar(false);expect(await service.boleta(1,estudiante,8)).toMatchObject({disponible:false,filas:[],promedioGeneral:null});
  await expect(service.boletaExcel(1,estudiante,8)).rejects.toThrow('evaluaciones requeridas');await expect(service.boletaPdf(1,estudiante,8)).rejects.toThrow('evaluaciones requeridas');
 });
 it('no publica ni calcula un promedio general con una nota faltante aunque el periodo diga cerrado',async()=>{
  const {service}=preparar(true,false);expect(await service.boleta(1,administrativo,8)).toMatchObject({disponible:false,promedioGeneral:null});
 });
 it('control escolar debe tener alcance sobre el plantel histórico de la inscripción',async()=>{
  const {service,scope}=preparar();scope.validarGestion.mockRejectedValue(new Error('Plantel ajeno'));
  await expect(service.boleta(1,administrativo,8)).rejects.toThrow('Plantel ajeno');expect(scope.validarGestion).toHaveBeenCalledWith(administrativo,2);
 });
 it('emite Excel completo con créditos y el promedio vigente sin convertir escala',async()=>{
  const {service}=preparar();const wb=new ExcelJS.Workbook();await wb.xlsx.load(await service.boletaExcel(1,estudiante,8) as never);
  const ws=wb.getWorksheet('Boleta')!;expect(ws.getCell('B8').value).toBe('0311');expect(ws.getCell('D8').value).toBe(7);expect(ws.getCell('G8').value).toBe(60);expect(ws.getCell('E8').value).toBe('');
  expect((await service.boletaPdf(1,estudiante,8)).subarray(0,4).toString()).toBe('%PDF');
 });
 it('conserva cero en el acta llena y deja las evaluaciones vacías en la plantilla',async()=>{
  const {service,reportes}=preparar();const lleno=new ExcelJS.Workbook(),vacio=new ExcelJS.Workbook();
  await lleno.xlsx.load(await service.actaExcel(3,1,administrativo,false) as never);await vacio.xlsx.load(await service.actaExcel(3,1,administrativo,true) as never);
  expect(reportes.validarAccesoAClase).toHaveBeenCalledWith(3,administrativo);expect(lleno.getWorksheet('Acta')!.getCell('W8').value).toBe(0);expect(vacio.getWorksheet('Acta')!.getCell('W8').value).toBe('');
  expect(lleno.getWorksheet('Acta')!.pageSetup.fitToWidth).toBe(1);
 });
 it('rechaza periodos inválidos y no devuelve un acta de otra clase',async()=>{
  const {service,reportes,ds}=preparar();await expect(service.acta(3,5,administrativo)).rejects.toThrow('Selecciona');expect(ds.getRepository).not.toHaveBeenCalled();
  reportes.validarAccesoAClase.mockRejectedValue(new Error('Clase ajena'));await expect(service.acta(3,1,administrativo)).rejects.toThrow('Clase ajena');expect(ds.getRepository).not.toHaveBeenCalled();
 });
});

it('publica boleta y Excel únicamente al cerrar todos los parciales completos', async () => {
 const {service,periodos}=preparar(false);
 expect(await service.boleta(1,estudiante,8)).toMatchObject({disponible:false,filas:[]});
 for(const periodo of periodos) periodo.estatus='CERRADO';
 expect(await service.boleta(1,estudiante,8)).toMatchObject({disponible:true,promedioGeneral:60});
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(await service.boletaExcel(1,estudiante,8) as never);
 expect(wb.getWorksheet('Boleta')!.getCell('G8').value).toBe(60);
});
it('no entrega Excel ni PDF al alumno con notas incompletas aunque todos los periodos estén cerrados', async () => {
 const {service}=preparar(true,false);
 expect(await service.boleta(1,estudiante,8)).toMatchObject({disponible:false,filas:[]});
 await expect(service.boletaExcel(1,estudiante,8)).rejects.toThrow('evaluaciones requeridas');
 await expect(service.boletaPdf(1,estudiante,8)).rejects.toThrow('evaluaciones requeridas');
});
it('el acta Final no reutiliza P1 y exporta la nota pendiente vacía', async () => {
 const {service}=preparar();
 expect(await service.acta(3,0,administrativo)).toMatchObject({evaluacion:'Final',faltantes:1,filas:[{calificacion:null}]});
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(await service.actaExcel(3,0,administrativo,false) as never);
 expect(wb.getWorksheet('Acta')!.getCell('W8').value).toBe('');
});
