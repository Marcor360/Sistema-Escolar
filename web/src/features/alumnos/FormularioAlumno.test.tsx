import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormularioAlumno } from './FormularioAlumno';
import { FORM_INICIAL } from './tipos';

afterEach(cleanup);

function mostrar(curp: string, editando: number | null = null) {
  const form = { ...FORM_INICIAL, curp };
  return render(<FormularioAlumno
    editando={editando}
    crear={vi.fn().mockResolvedValue(undefined)}
    enviando={false}
    form={form}
    setForm={vi.fn()}
    planteles={[{ id: 1, nombre: 'Plantel central' }]}
    dar={(campo) => ({ value: form[campo], onChange: vi.fn() })}
    setEditando={vi.fn()}
    error=""
    mensaje=""
  />);
}

describe('FormularioAlumno', () => {
  it('agrupa identidad, credenciales y contacto, y obliga a completar CURP en nuevas altas', () => {
    mostrar('');
    expect(screen.getByRole('group', { name: 'Identidad del alumno' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Acceso institucional' })).toBeTruthy();
    expect(screen.getByText(/todavía no se asigna un grupo ni materias/)).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Contacto y datos adicionales' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Registrar alumno' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('CURP *') as HTMLInputElement).required).toBe(true);
  });

  it('permite enviar el formulario cuando la CURP está completa', () => {
    mostrar('GODE561231HDFRRN09');
    expect((screen.getByRole('button', { name: 'Registrar alumno' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('no bloquea la edición de expedientes anteriores sin CURP', () => {
    mostrar('', 12);
    expect((screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByLabelText('CURP') as HTMLInputElement).required).toBe(false);
  });
});

it('mantiene segundo nombre opcional y exige el segundo apellido', () => {
  mostrar('GODE561231HDFRRN09');
  const segundo = screen.getByLabelText('Segundo nombre (opcional)') as HTMLInputElement;
  const materno = screen.getByLabelText('Segundo apellido *') as HTMLInputElement;
  expect(segundo.required).toBe(false);
  expect(materno.required).toBe(true);
  const campos = [...document.querySelectorAll<HTMLInputElement>('#form-alumno input')].map(campo => campo.id);
  expect(campos.indexOf('alumno-nombre')).toBeLessThan(campos.indexOf('alumno-segundo-nombre'));
  expect(campos.indexOf('alumno-segundo-nombre')).toBeLessThan(campos.indexOf('alumno-paterno'));
  expect(campos.indexOf('alumno-paterno')).toBeLessThan(campos.indexOf('alumno-materno'));
  expect(campos.indexOf('alumno-materno')).toBeLessThan(campos.indexOf('alumno-correo'));
});
