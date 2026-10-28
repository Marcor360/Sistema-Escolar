import { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { SelectorBuscable } from '../../components/SelectorBuscable';
import type { Grupo, Inscripcion, Alumno } from './tipos';
import type * as React from 'react';
interface Props {
motivo:string;setMotivo:(v:string)=>void;documento:string;setDocumento:(v:string)=>void;
seleccionado: Grupo;
inscribir: (e: FormEvent) => Promise<void>;
alumnoId: string;
setAlumnoId: React.Dispatch<React.SetStateAction<string>>;
enviando: boolean;
inscritos: Inscripcion[];
operar: (ruta: string, metodo: 'delete' | 'patch', datos?: object) => Promise<void>;
}
export function InscripcionesGrupo({ seleccionado, motivo,setMotivo,documento,setDocumento, inscribir, alumnoId, setAlumnoId, enviando, inscritos, operar }: Props) { return (<section className="panel">
            <h2>Alumnos inscritos en {seleccionado.nombre}</h2>
            <p className="texto-ayuda">Las altas ordinarias deben realizarse mediante cartera. Esta ruta solo reactiva una inscripción previa en baja de este mismo grupo, con motivo y referencia documental; no crea altas nuevas ni cargos retroactivos. Utiliza <Link to="/apertura-cartera/nueva">Apertura de cartera</Link>. Las correcciones directas requieren autorización de Control Escolar.</p>
            <form onSubmit={inscribir} className="fila" style={{ marginBottom: 14 }}>
              <SelectorBuscable<Alumno> ruta="/alumnos" valor={alumnoId} cambiar={setAlumnoId} etiqueta="Alumno"
                filtros={{ plantelId: seleccionado.plantel?.id }} texto={(a) => `${a.matricula} — ${a.usuario.nombre} ${a.usuario.apellidoPaterno}`} />
              <label>Motivo de reactivación<input required minLength={10} maxLength={300} value={motivo} onChange={e=>setMotivo(e.target.value)}/></label><label>Referencia documental<input required minLength={5} maxLength={200} value={documento} onChange={e=>setDocumento(e.target.value)}/></label>
              <button disabled={enviando} className="boton">Reactivar inscripción previa</button>
            </form>
            <div className="tabla-contenedor" role="region" aria-label="Inscripciones del grupo" tabIndex={0}><table className="tabla">
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
            </table></div>
          </section>); }
