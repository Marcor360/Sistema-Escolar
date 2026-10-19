import { Link } from 'react-router-dom';

/** Orientación de preparación, sin duplicar información ni alterar el estado del ciclo. */
export function GuiaPreparacionCiclo() {
  return (
    <details className="panel" aria-label="Requisitos del ciclo escolar">
      <summary>¿Qué debe incluir el ciclo escolar?</summary>
      <p className="texto-ayuda">El ciclo identifica un rango de fechas y un estado. La oferta de planteles, planes, materias y grupos se configura en módulos relacionados, no como campos adicionales del ciclo.</p>
      <ol>
        <li><strong>Fechas y estado:</strong> registrar clave, nombre, inicio y fin. Solo Superadmin puede activarlo o cerrarlo.</li>
        <li><Link to="/catalogos-academicos">Niveles, carreras y periodos académicos</Link>: relacionar sede, plan y ciclo.</li>
        <li><Link to="/materias?vista=consulta">Materias, créditos y tipos</Link>: relacionar cada materia con los planes y periodos aplicables.</li>
        <li><Link to="/grupos?vista=consulta">Grupos, turnos y docentes</Link>: asignar materias y maestros a los grupos compatibles.</li>
        <li><Link to="/apertura-cartera">Apertura de cartera</Link>: inscribir alumnos y previsualizar cargos existentes en Finanzas.</li>
      </ol>
      <p className="texto-ayuda">Los parciales de calificaciones no son los periodos académicos. Crear un ciclo no genera grupos, temarios, inscripciones ni cargos por sí solo.</p>
    </details>
  );
}
