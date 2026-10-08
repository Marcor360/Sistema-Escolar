import { abrirArchivo } from '../../api/client';
import { fechaHora } from '../../utils/formato';
import type { Actividad, Entrega } from './tipos';
import type * as React from 'react';
interface Props {
actividadActiva: Actividad;
entregas: Entrega[];
comentarios: Record<number, string>;
setComentarios: React.Dispatch<React.SetStateAction<Record<number, string>>>;
notas: Record<number, string>;
setNotas: React.Dispatch<React.SetStateAction<Record<number, string>>>;
enviando: boolean;
guardarNota: (entrega: Entrega) => Promise<void>;
guardadas: Set<number>;
}
export function EntregasClase({ actividadActiva, entregas, comentarios, setComentarios, notas, setNotas, enviando, guardarNota, guardadas }: Props) { return (<section className="panel">
          <h2>Entregas — {actividadActiva.titulo}</h2>
          <table className="tabla">
            <thead>
              <tr><th>Alumno</th><th>Fecha</th><th>Estatus</th><th>Archivo</th><th style={{ width: 190 }}>Calificación</th></tr>
            </thead>
            <tbody>
              {entregas.map((e) => (
                <tr key={e.id} title={e.comentarioAlumno ?? undefined}>
                  <td>{e.alumno.matricula} — {e.alumno.usuario.nombre} {e.alumno.usuario.apellidoPaterno}<p>Comentario del alumno: {e.comentarioAlumno ?? 'Sin comentario'}</p></td>
                  <td>{fechaHora(e.fechaEntregado)}</td>
                  <td>
                    <span className={`sello ${e.estatus === 'CALIFICADA' ? 'ok' : e.estatus === 'TARDE' ? 'mal' : 'aviso'}`}>
                      {e.estatus}
                    </span>
                  </td>
                  <td>{e.archivoRuta ? <button className="enlace" onClick={() => abrirArchivo('entregas', e.id)}>Ver archivo</button> : '—'}</td>
                  <td>
                    <label htmlFor={`feedback-${e.id}`}>Retroalimentación</label><textarea id={`feedback-${e.id}`} maxLength={500} value={comentarios[e.id] ?? ''} onChange={(ev) => setComentarios({ ...comentarios, [e.id]: ev.target.value })} />
                    <span className="captura-nota">
                      <input
                        type="number" min={0} max={100} step={0.1}
                        value={notas[e.id] ?? ''}
                        onChange={(ev) => setNotas({ ...notas, [e.id]: ev.target.value })}
                      />
                      <button disabled={enviando} className="boton chico" onClick={() => guardarNota(e)}>
                        {guardadas.has(e.id) ? '✓' : 'Guardar'}
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
              {entregas.length === 0 && (
                <tr><td className="vacio" colSpan={5}>Aún no hay entregas de los alumnos.</td></tr>
              )}
            </tbody>
          </table>
        </section>); }
