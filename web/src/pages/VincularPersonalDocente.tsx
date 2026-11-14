import { FormEvent, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { SelectorBuscable } from '../components/SelectorBuscable';
interface Cuenta { id: number; nombre: string; correo: string; roles: string[] }
export function VincularPersonalDocente({ terminado, ocupacion }: { terminado: () => void; ocupacion: (valor: boolean) => void }) {
  const enviando = useRef(false);
  const [usuarioId, setUsuarioId] = useState('');
  const [numero, setNumero] = useState(''), [cedula, setCedula] = useState('');
  const [pendiente, setPendiente] = useState(false), [especialidad, setEspecialidad] = useState('');
  const [ocupado, setOcupado] = useState(false), [error, setError] = useState('');
  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando.current) return;
    enviando.current = true;
    setOcupado(true); ocupacion(true); setError('');
    try {
      await api.post('/docentes/vincular-personal', { usuarioId: Number(usuarioId), numEmpleado: numero.trim(), cedulaPendiente: pendiente, ...(pendiente ? {} : { cedulaProfesional: cedula.trim() }), ...(especialidad.trim() ? { especialidad: especialidad.trim() } : {}) });
      terminado();
    } catch (err) { setError(mensajeDeError(err)); }
    finally { enviando.current = false; setOcupado(false); ocupacion(false); }
  };
  return <form className="panel" onSubmit={guardar} aria-busy={ocupado}>
    <h2>Vincular personal existente como docente</h2>
    <p>Conserva la misma cuenta, contraseña, funciones y planteles. Un director, personal de Finanzas o Administrativo puede también impartir clases. Se cerrarán sus sesiones para actualizar sus permisos.</p>
    {error && <p role="alert">{error}</p>}
    <fieldset disabled={ocupado}><legend>Expediente docente</legend>
      <SelectorBuscable<Cuenta> ruta="/usuarios/listado" filtros={{ tipo: 'PERSONAL' }} etiqueta="Cuenta de personal" valor={usuarioId} cambiar={setUsuarioId} texto={c => `${c.nombre} · ${c.correo} · ${c.roles.join(', ')}`} />
      <label htmlFor="vinculo-empleado">Núm. empleado</label><input id="vinculo-empleado" required maxLength={20} value={numero} onChange={e => setNumero(e.target.value)} />
      <label className="casilla"><input type="checkbox" checked={pendiente} onChange={e => setPendiente(e.target.checked)} />Cédula pendiente de capturar</label>
      <label htmlFor="vinculo-cedula">Cédula profesional</label><input id="vinculo-cedula" required={!pendiente} disabled={pendiente} maxLength={20} value={cedula} onChange={e => setCedula(e.target.value)} />
      <label htmlFor="vinculo-especialidad">Especialidad</label><input id="vinculo-especialidad" maxLength={120} value={especialidad} onChange={e => setEspecialidad(e.target.value)} />
      <button className="boton" disabled={ocupado || !usuarioId}>Vincular expediente docente</button>
    </fieldset>
  </form>;
}
