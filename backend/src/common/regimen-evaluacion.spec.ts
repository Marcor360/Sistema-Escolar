import { alumnosConFinalDisponible, calcularPonderada, notaEnEscala, parcialesDe, REGIMEN_NUEVO, resultadoEvaluacion } from './regimen-evaluacion';
import { boletaPublicable } from '../reportes/publicacion-boleta';
const nueva = { id: 1, regimenEvaluacion: REGIMEN_NUEVO };
const notas = (valores:number[]) => valores.map((calificacion,i)=>({grupoMateriaId:1,parcial:i+1,calificacion,escalaMaxima:10}));
describe('Reglamento de cuatro parciales sin alterar originales',()=>{
 it('exige P4; conserva decimales y no activa un redondeo no definido',()=>{
  expect(parcialesDe(nueva)).toEqual([1,2,3,4]);
  expect(resultadoEvaluacion(notas([7.5,7.5,7.5]),nueva)).toBeNull();
  expect(resultadoEvaluacion(notas([7.5,7.5,7.5,7.6]),nueva)).toBe(7.525);
 });
 it('Final manual sustituye el promedio incluso con cero y sin parciales',()=>{
  expect(resultadoEvaluacion([...notas([10,10,10,10]),{parcial:0,calificacion:0,escalaMaxima:10}],nueva)).toBe(0);
  expect(resultadoEvaluacion([{parcial:0,calificacion:6.7,escalaMaxima:10}],nueva)).toBe(6.7);
 });
 it('lee 85/100 como 8.5/10 sin modificar el objeto original',()=>{
  const original={parcial:1,calificacion:85,escalaMaxima:100};
  expect(notaEnEscala(original,nueva)).toBe(8.5);expect(original.calificacion).toBe(85);
  expect(resultadoEvaluacion([original,...notas([0,9,7,6]).slice(1)],nueva)).toBe(7.625);
 });
 it('conserva el régimen histórico y su Final independiente',()=>{
  expect(resultadoEvaluacion([{parcial:1,calificacion:60},{parcial:2,calificacion:90},{parcial:3,calificacion:90},{parcial:0,calificacion:0}],{})).toBe(80);
 });
 it('pondera con enteros exactos, sin redondear el parcial',()=>{
  expect(calcularPonderada([{nombre:'Actividad',porcentaje:33.33},{nombre:'Examen',porcentaje:66.67}],[7.01,8.02])).toBe(7.683367);
 });
 it.each([[[{nombre:'A',porcentaje:99.99}],[9]],[[{nombre:'A',porcentaje:100}],[10.01]],[[{nombre:'A',porcentaje:100}],[]],[[{nombre:' ',porcentaje:100}],[0]]])('rechaza ponderaciones o notas inválidas (%j)',(criterios, valores)=>{
  expect(()=>calcularPonderada(criterios as {nombre:string;porcentaje:number}[],valores as number[])).toThrow();
 });
 it('no publica Final manual abierta aunque estén cerrados P1–P4',()=>{
  const n=[...notas([7,8,9,10]),{grupoMateriaId:1,parcial:0,calificacion:8,escalaMaxima:10}];
  const periodos=[1,2,3,4].map(parcial=>({grupoMateriaId:1,parcial,estatus:'CERRADO'}));
  expect(boletaPublicable([nueva],n,periodos)).toBe(false);
  expect(boletaPublicable([nueva],n,[...periodos,{grupoMateriaId:1,parcial:0,estatus:'CERRADO'}])).toBe(true);
 });
});

it('el cierre de Final combina alumnos con sustitución y alumnos con promedio completo',()=>{
 const notas=[{alumnoId:1,parcial:0},...[1,2,3,4].map(parcial=>({alumnoId:2,parcial})),{alumnoId:3,parcial:1}];
 expect([...alumnosConFinalDisponible(notas,[])]).toEqual([1]);
 expect([...alumnosConFinalDisponible(notas,[1,2,3,4].map(parcial=>({parcial,estatus:'CERRADO'})))]).toEqual([1,2]);
});
