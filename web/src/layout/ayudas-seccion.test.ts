import { describe, expect, it } from 'vitest';
import { descripcionSeccion } from './ayudas-seccion';

describe('guías de proceso por sección', () => {
  it('distingue alta de alumno de inscripción y operaciones financieras', () => {
    expect(descripcionSeccion('/alumnos')).toContain('no significa que ya esté inscrito');
    expect(descripcionSeccion('/apertura-cartera/nueva')).toContain('solicitud en pausa');
    expect(descripcionSeccion('/finanzas')).toContain('programación, cargo, pago');
  });
  it('respeta los límites reales del director y de la app alumno', () => {
    expect(descripcionSeccion('/planteles')).toContain('Superadmin');
    expect(descripcionSeccion('/roles-personal')).toContain('funciones subordinadas');
    expect(descripcionSeccion('/maestro')).toContain('clase asignada');
  });
  it('cubre formularios hijos sin crear ayudas para rutas inexistentes', () => {
    expect(descripcionSeccion('/catalogos-academicos/niveles/nuevo')).toContain('Maestría');
    expect(descripcionSeccion('/docentes/12/editar')).toContain('Crear un docente');
    expect(descripcionSeccion('/ruta-desconocida')).toBeNull();
  });
});
