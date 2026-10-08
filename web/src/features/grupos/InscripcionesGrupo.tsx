import { FormEvent } from 'react';
import { SelectorBuscable } from '../../components/SelectorBuscable';
import type { Grupo, Inscripcion, Alumno } from './tipos';
import type * as React from 'react';
interface Props {
seleccionado: Grupo;
inscribir: (e: FormEvent) => Promise<void>;
alumnoId: string;
setAlumnoId: React.Dispatch<React.SetStateAction<string>>;
enviando: boolean;
inscritos: Inscripcion[];
operar: (ruta: string, metodo: 'delete' | 'patch', datos?: object) => Promise<void>;
}
export function InscripcionesGrupo({ seleccionado, inscribir, alumnoId, setAlumnoId, enviando, inscritos, operar }: Props) { return (<section className="panel">
            <h2>Alumnos inscritos en {seleccionado.nombre}</h2>
            <form onSubmit={inscribir} className="fila" style={{ marginBottom: 14 }}>
              <SelectorBuscable<Alumno> ruta="/alumnos" valor={alumnoId} cambiar={setAlumnoId} etiqueta="Alumno"
                filtros={{ plantelId: seleccionado.plantel?.id }} texto={(a) => `${a.matricula} — ${a.usuario.nombre} ${a.usuario.apellidoPaterno}`} />
              <button disabled={enviando} className="boton">Inscribir</button>
            </form>
            <table className="tabla">
              <thead><tr><th>Matrícula</th><th>Alumno</th><th>Correcciones</th></tr></thead>
              <tbody>
                {inscritos.map((i) => (
                  <tr key={i.id}>
                    <td>{i.alumno.matricula}</td>
                    <td>{i.alumno.usuario.nombre} {i.alumno.usuario.apellidoPaterno}</td><td><button disabled={enviando} onClick={() => operar(`/academico/inscripciones/${i.id}`, 'delete')}>Dar de baja inscripción</button></td>
                  </tr>
                ))}
                {inscritos.length === 0 && <tr><td className="vacio" colSpan={2}>Sin alumnos inscritos.</td></tr>}
              </tbody>
            </table>
          </section>); }
