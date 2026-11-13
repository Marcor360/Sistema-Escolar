import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/** Orden de trabajo; no marca un paso como terminado sin comprobar datos reales. */
export function RutaCargaAcademica() {
  const { tieneRol } = useAuth();
  const control = tieneRol('ADMINISTRATIVO', 'SUPERADMIN');
  const alumnos = tieneRol('FINANZAS', 'SUPERADMIN');
  const pasos = [
    ...(control ? [
      { titulo: 'Preparar ciclo y oferta', detalle: 'Revisa plantel, fechas del ciclo, nivel, carrera o plan y periodo académico. Crear el ciclo no crea grupos.', enlaces: [['Revisar ciclos', '/materias?vista=ciclos'], ['Revisar oferta académica', '/catalogos-academicos']] },
      { titulo: 'Registrar materias', detalle: 'Crea cada materia una sola vez con su clave y créditos. En Consultar materias, vincúlala con los planes y periodos donde se impartirá.', enlaces: [['Registrar materia', '/materias?vista=nuevo'], ['Consultar y vincular materias', '/materias?vista=consulta']] },
      { titulo: 'Preparar docentes y grupos', detalle: 'Revisa que los docentes pertenezcan al plantel. Crea el grupo con plantel, ciclo y turno; usa el contexto académico que corresponda.', enlaces: [['Consultar docentes', '/docentes'], ['Crear grupo', '/grupos?vista=nuevo']] },
      { titulo: 'Asignar materias al grupo', detalle: 'Busca el grupo y pulsa Administrar. Asigna cada materia y su docente. Revisa las materias sin profesor antes de comenzar clases.', enlaces: [['Consultar grupos y asignar materias', '/grupos?vista=consulta']] },
    ] : []),
    { titulo: 'Revisar expedientes de alumnos', detalle: alumnos ? 'Descarga la plantilla de alumnos, completa los datos y previsualiza. Los alumnos nuevos válidos se importan; los existentes se omiten y los errores se corrigen por separado.' : 'Consulta los expedientes existentes. El alta y la importación de alumnos requieren Finanzas o Superadmin; coordina esa carga antes de inscribir.', enlaces: [['Consultar alumnos', '/alumnos?vista=consulta'], ...(alumnos ? [['Importar alumnos', '/operaciones?vista=importar&tipo=ALUMNOS']] : [])] },
    ...(control ? [{ titulo: 'Inscribir y comprobar', detalle: 'Para inscripciones ordinarias utiliza Apertura de cartera y revisa su previsualización. La importación de inscripciones es una operación académica separada; no genera cargos. Comprueba el grupo, sus materias y la lista final de alumnos.', enlaces: [['Abrir cartera e inscribir', '/apertura-cartera'], ['Verificar grupos', '/grupos?vista=consulta']] }] : []),
  ];
  return <section className="panel ruta-carga" aria-labelledby="ruta-carga-titulo">
    <p className="texto-ayuda">PREPARACIÓN ACADÉMICA</p>
    <h2 id="ruta-carga-titulo">Carga académica, paso a paso</h2>
    <p>Trabaja en este orden para conectar materias, grupos y alumnos. Cada enlace abre la operación correspondiente; puedes volver a esta guía cuando lo necesites.</p>
    <ol className="ruta-carga-pasos">{pasos.map((paso, i) => <li key={paso.titulo}>
      <span className="ruta-carga-numero" aria-hidden="true">{i + 1}</span><div><h3>{paso.titulo}</h3><p>{paso.detalle}</p>
        <div className="ruta-carga-enlaces">{paso.enlaces.map(([titulo, destino]) => <Link key={destino} className="boton secundario" to={destino}>{titulo}</Link>)}</div>
      </div>
    </li>)}</ol>
    <details><summary>¿Qué puedo importar con CSV o Excel?</summary><p>Importaciones admite alumnos, docentes, personal e inscripciones según tu rol, hasta 500 filas y 5 MB. Materias y grupos se registran en sus módulos; no utilices la plantilla de alumnos para cargarlos. Las calificaciones tienen su propia importación.</p></details>
  </section>;
}
