import { useState } from 'react';
import { BoletaEscolar } from '../../components/BoletaEscolar';
import type { Alumno, Historial, Nota } from './tipos';
import { Paginador } from '../../components/Paginador';
import type * as React from 'react';
export interface HistorialConsulta { alumno: Alumno; registros: Historial[]; total: number; pagina: number; porPagina: number; }
interface Props {
historial: HistorialConsulta;
boleta: (alumno: Alumno, cicloId?: number, inscripcionId?: number) => Promise<void>;
cargandoNotas: boolean;
verNotas: (alumno: Alumno, inscripcion: Historial) => Promise<void>;
notas: Nota[] | null;
setHistorial: React.Dispatch<React.SetStateAction<HistorialConsulta | null>>;
cargando: boolean;
cambiarPagina: (pagina: number) => void;
}
export function HistorialAlumno({ historial, boleta, cargandoNotas, verNotas, notas, setHistorial, cargando, cambiarPagina }: Props) { const [boletaId,setBoletaId]=useState<number|null>(null); return (<section className="panel"><h2>Historial de {historial.alumno.matricula}</h2>
        {historial.registros.map((i) => <p key={i.id}>{i.grupo.ciclo.nombre} · {i.grupo.nombre} · {i.grupo.plantel.nombre} · {i.estatus}
          <button onClick={() => boleta(historial.alumno, i.grupo.ciclo.id, i.id)}>Boleta de esta inscripción</button>
          <button onClick={()=>setBoletaId(i.id)}>Ver boleta informativa y Excel</button>
          <button disabled={cargandoNotas} onClick={() => verNotas(historial.alumno, i)}>Ver calificaciones</button></p>)}
        <Paginador total={historial.total} pagina={historial.pagina} porPagina={historial.porPagina} deshabilitado={cargando} onCambio={cambiarPagina} />
        {cargando && <p role="status">Cargando historial…</p>}
        {boletaId!==null && <BoletaEscolar key={`${historial.alumno.id}-${boletaId}`} alumnoId={historial.alumno.id} inscripcionId={boletaId}/>}
        {cargandoNotas && <p role="status">Cargando calificaciones…</p>}
        {notas && <div className="tabla-contenedor" role="region" aria-label="Calificaciones de la inscripción" tabIndex={0}><table className="tabla"><thead><tr><th>Materia</th><th>Parcial</th><th>Nota</th><th>Promedio oficial P1-P3</th></tr></thead>
          <tbody>{notas.map((n) => <tr key={n.id}><td>{n.grupoMateria.materia.nombre}</td><td>{n.parcial === 0 ? 'Final' : `P${n.parcial}`}</td><td>{n.calificacion}</td><td>{n.promedioOficial ?? 'Pendiente'}</td></tr>)}</tbody></table></div>}
        {notas?.length === 0 && <p>Sin calificaciones en esta inscripción.</p>}
        {!historial.registros.length && <p>Sin inscripciones registradas.</p>}<button onClick={() => setHistorial(null)}>Cerrar historial</button>
      </section>); }
