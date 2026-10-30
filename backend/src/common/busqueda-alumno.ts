/** Condición portable MySQL/SQL Server para matrícula, nombres y nombre completo.
 * Los alias son constantes internas del QueryBuilder; el texto del usuario siempre va parametrizado. */
export function condicionBusquedaAlumno(alumno: string, usuario: string): string {
  return `(${alumno}.matricula LIKE :buscar OR ${usuario}.nombre LIKE :buscar OR ${usuario}.segundo_nombre LIKE :buscar OR ${usuario}.apellido_paterno LIKE :buscar OR ${usuario}.apellido_materno LIKE :buscar OR CONCAT(${usuario}.nombre, ' ', ${usuario}.apellido_paterno, ' ', COALESCE(${usuario}.apellido_materno, '')) LIKE :buscar)`;
}
