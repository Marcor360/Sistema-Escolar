import { condicionBusquedaAlumno } from './busqueda-alumno';

describe('condicionBusquedaAlumno', () => {
  it('admite matrícula, apellido o nombre completo, sin concatenación exclusiva de un motor', () => {
    const condicion = condicionBusquedaAlumno('a', 'u');
    expect(condicion).toContain('a.matricula LIKE :buscar');
    expect(condicion).toContain('u.apellido_materno LIKE :buscar');
    expect(condicion).toContain("CONCAT(u.nombre, ' ', u.apellido_paterno, ' ', COALESCE(u.apellido_materno, '')) LIKE :buscar");
    expect(condicion).not.toContain('%');
  });
});
