import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ResumenPreparacionGrupo } from './ResumenPreparacionGrupo';
afterEach(cleanup);
it('no interpreta la ausencia de periodo como cero materias pendientes',()=>{
  render(<ResumenPreparacionGrupo resumen={{asignadas:2,sinDocente:1,inscritos:15,esperadas:null,pendientes:null}}/>);
  expect(screen.getByText('Sin periodo vinculado: revisa el plan')).toBeTruthy();
  expect(screen.getByText('15 alumnos inscritos')).toBeTruthy();
  expect(screen.queryByText(/0 de/)).toBeNull();
});
it('distingue las materias del periodo de las asignaciones existentes',()=>{
  render(<ResumenPreparacionGrupo resumen={{asignadas:2,sinDocente:1,inscritos:15,esperadas:4,pendientes:2}}/>);
  expect(screen.getByText('2 de 4 materias del periodo por revisar')).toBeTruthy();
  expect(screen.getByText('1 sin docente activo')).toBeTruthy();
});
