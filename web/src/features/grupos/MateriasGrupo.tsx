import { FormEvent } from 'react';
import { SelectorBuscable } from '../../components/SelectorBuscable';
import type { Grupo, Materia, Docente, GrupoMateria } from './tipos';
import type * as React from 'react';
interface Props {
seleccionado: Grupo;
reasignando: number | null;
nuevoDocente: string;
setNuevoDocente: React.Dispatch<React.SetStateAction<string>>;
enviando: boolean;
operar: (ruta: string, metodo: 'delete' | 'patch', datos?: object) => Promise<void>;
setReasignando: React.Dispatch<React.SetStateAction<number | null>>;
asignarMateria: (e: FormEvent) => Promise<void>;
materiaId: string;
setMateriaId: React.Dispatch<React.SetStateAction<string>>;
materias: Materia[];
docenteId: string;
setDocenteId: React.Dispatch<React.SetStateAction<string>>;
asignaciones: GrupoMateria[];
}
export function MateriasGrupo({ seleccionado, reasignando, nuevoDocente, setNuevoDocente, enviando, operar, setReasignando, asignarMateria, materiaId, setMateriaId, materias, docenteId, setDocenteId, asignaciones }: Props) { return (<section className="panel">
            <h2>Materias del grupo {seleccionado.nombre} · {seleccionado.ciclo.clave} · {seleccionado.plantel?.nombre}</h2>
            {reasignando && <div className="fila"><SelectorBuscable<Docente> ruta="/docentes" valor={nuevoDocente} cambiar={setNuevoDocente}
              etiqueta="Nuevo docente" filtros={{ plantelId: seleccionado.plantel?.id }} texto={(d) => `${d.numEmpleado} — ${d.usuario.nombre} ${d.usuario.apellidoPaterno}`} />
              <button disabled={enviando || !nuevoDocente} onClick={() => operar(`/academico/grupo-materias/${reasignando}/docente/${nuevoDocente}`, 'patch')}>Confirmar reasignación</button>
              <button onClick={() => setReasignando(null)}>Cancelar</button></div>}
            <form onSubmit={asignarMateria} className="fila" style={{ marginBottom: 14 }}>
              <div className="campo"><label htmlFor="grupos-campo-7">Materia</label>
                <select id="grupos-campo-7" required value={materiaId} onChange={(e) => setMateriaId(e.target.value)}>
                  <option value="">Selecciona…</option>
                  {materias.map((m) => <option key={m.id} value={m.id}>{m.clave} — {m.nombre}</option>)}
                </select>
              </div>
              <SelectorBuscable<Docente> ruta="/docentes" valor={docenteId} cambiar={setDocenteId} etiqueta="Docente" requerido={false}
                filtros={{ plantelId: seleccionado.plantel?.id }} texto={(d) => `${d.numEmpleado} — ${d.usuario.nombre} ${d.usuario.apellidoPaterno}`} />
              <button disabled={enviando} className="boton">Asignar materia</button>
            </form>
            <table className="tabla">
              <thead><tr><th>Materia</th><th>Docente</th><th>Correcciones</th></tr></thead>
              <tbody>
                {asignaciones.map((gm) => (
                  <tr key={gm.id}>
                    <td>{gm.materia.clave} — {gm.materia.nombre}</td>
                    <td>{gm.docente ? `${gm.docente.usuario.nombre} ${gm.docente.usuario.apellidoPaterno}` : <span className="sello aviso">Sin docente</span>}</td>
                    <td><button disabled={enviando} onClick={() => { setReasignando(gm.id); setNuevoDocente(''); }}>Reasignar docente</button>
                      <button disabled={enviando} onClick={() => operar(`/academico/grupo-materias/${gm.id}`, 'delete')}>Quitar materia</button></td>
                  </tr>
                ))}
                {asignaciones.length === 0 && <tr><td className="vacio" colSpan={2}>Sin materias asignadas.</td></tr>}
              </tbody>
            </table>
          </section>); }
