import { useModuloTrabajo } from '../components/ModuloTrabajo';
import { EliminarRegistro } from '../components/EliminarRegistro';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Encabezado } from '../components/Encabezado';
import { Paginador } from '../components/Paginador';
import { SelectorProveedorCorreo, type ProveedorCorreo } from '../components/SelectorProveedorCorreo';

type Tipo = 'ALUMNO' | 'DOCENTE' | 'ADMINISTRATIVO';
interface Plantel { id: number; nombre: string }
interface Fila {
  id: number; usuarioId?:number; activacionPendiente?:boolean; matricula?: string; numEmpleado?: string; nombre: string; correo?: string | null;
  plantel?: string | null; planteles?: string[]; estatus?: string; roles?: string[]; activo?: boolean;
}
interface Resultado { datos: Fila[]; total: number; pagina: number; porPagina: number }
const ROLES_PERSONAL = ['ADMINISTRATIVO', 'FINANZAS', 'SUPERADMIN'] as const;
const FORM_INICIAL = { email: '', nombre: '', apellidoPaterno: '', apellidoMaterno: '', telefono: '', correoProveedor: 'GODADDY' as ProveedorCorreo };

export default function UsuariosPage() {
  const { sesion } = useAuth();
  const esSuperadmin = sesion?.roles.includes('SUPERADMIN') ?? false;
  const puedeRestablecer = esSuperadmin || (sesion?.roles.includes('ADMINISTRATIVO') ?? false);
  const maestroPuro = sesion?.roles.includes('MAESTRO') &&
    !sesion.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO'].includes(r));
  const tituloFormRef = useRef<HTMLHeadingElement>(null);
  const [editarId, setEditarId] = useState<number | null>(null); const [activo, setActivo] = useState(true);
  useEffect(() => { if (editarId !== null) tituloFormRef.current?.focus(); }, [editarId]);

  const [sinCorreo,setSinCorreo]=useState(false), [asignarCorreo,setAsignarCorreo]=useState<Fila|null>(null), [nuevoCorreo,setNuevoCorreo]=useState(''), [proveedorAlumno,setProveedorAlumno]=useState<ProveedorCorreo>('MICROSOFT365');
  const correoTitulo=useRef<HTMLHeadingElement>(null), origenCorreo=useRef<HTMLButtonElement|null>(null);
  useEffect(()=>{if(asignarCorreo)correoTitulo.current?.focus();},[asignarCorreo]);
  const [tipo, setTipo] = useState<Tipo>('ALUMNO');
  const [resultado, setResultado] = useState<Resultado>({ datos: [], total: 0, pagina: 1, porPagina: 10 });
  const [planteles, setPlanteles] = useState<Plantel[]>([]);
  const [plantelId, setPlantelId] = useState('');
  const [plantelIds, setPlantelIds] = useState<number[]>([]);
  const [enviando, setEnviando] = useState(false);
  const trabajo = useModuloTrabajo(enviando), legado = trabajo.modo === 'legado', consultaVisible = legado || trabajo.modo === 'consulta';
  const [cargando, setCargando] = useState(false); const consulta = useRef(0);
  const [buscar, setBuscar] = useState('');
  const [form, setForm] = useState(FORM_INICIAL);
  const [rolesElegidos, setRolesElegidos] = useState<string[]>(['ADMINISTRATIVO']);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cuentaRestablecer, setCuentaRestablecer] = useState<Fila | null>(null);
  const [passwordTemporal, setPasswordTemporal] = useState('');

  const activacionQuery = trabajo.query.get('activacionPendiente') === 'true';
  const consultar = useCallback(async (pagina = 1, tipoActual: Tipo = 'ALUMNO', plantelActual = '', termino = '', sinCorreoActual = false) => {
    const actual = ++consulta.current; setCargando(true); setError('');
    try {
      const { data } = await api.get<Resultado>('/usuarios/listado', {
        params: { ...(tipoActual==='ALUMNO'&&sinCorreoActual?{sinCorreo:'true'}:{}), ...(tipoActual==='ALUMNO'&&activacionQuery?{activacionPendiente:'true'}:{}), tipo: tipoActual, pagina, porPagina: 10, ...(plantelActual ? { plantelId: plantelActual } : {}), ...(termino ? { buscar: termino } : {}) },
      });
      if (actual === consulta.current) setResultado(data);
    } catch (err) { if (actual === consulta.current) setError(mensajeDeError(err)); }
    finally { if (actual === consulta.current) setCargando(false); }
  }, [activacionQuery]);
  const cargar = (pagina = 1, tipoActual: Tipo = 'ALUMNO', plantelActual = '', termino = '', sinCorreoActual = sinCorreo) => legado ? consultar(pagina,tipoActual,plantelActual,termino,sinCorreoActual) : Promise.resolve(trabajo.actualizar({pagina:String(pagina),tipo:tipoActual,plantel:plantelActual,buscar:termino,sinCorreo:tipoActual==='ALUMNO'&&sinCorreoActual?'true':'',activacionPendiente:tipoActual==='ALUMNO'&&activacionQuery?'true':''}));
  const paginaQuery = Math.max(1, Number(trabajo.query.get('pagina')) || 1), tipoQuery = (['ALUMNO','DOCENTE','ADMINISTRATIVO'].includes(trabajo.query.get('tipo') || '') ? trabajo.query.get('tipo') : 'ALUMNO') as Tipo, plantelQuery = trabajo.query.get('plantel') || '', buscarQuery = trabajo.query.get('buscar') || '';
  const sinCorreoQuery=trabajo.query.get('sinCorreo')==='true';
  useEffect(() => {
    api.get<Plantel[]>('/planteles/mios').then((r) => setPlanteles(r.data)).catch((err) => setError(mensajeDeError(err)));
  }, []);
  const invalidarConsulta = useCallback(() => { consulta.current++; }, []);
  useEffect(() => { if (!consultaVisible) return; setTipo(tipoQuery); setPlantelId(plantelQuery); setBuscar(buscarQuery); setSinCorreo(sinCorreoQuery); void consultar(paginaQuery,tipoQuery,plantelQuery,buscarQuery,sinCorreoQuery); return invalidarConsulta; }, [consultaVisible,paginaQuery,tipoQuery,plantelQuery,buscarQuery,sinCorreoQuery,consultar, invalidarConsulta]);
  useEffect(() => {
    if(legado) return;
    if(trabajo.modo === 'nuevo') { setEditarId(null); setForm(FORM_INICIAL); setRolesElegidos(['ADMINISTRATIVO']); setPlantelIds([]); }
    if(trabajo.modo !== 'editar' || !trabajo.id || !esSuperadmin) return;
    let vigente = true;
    api.get(`/usuarios/${trabajo.id}/personal`).then(({data})=>{ if(!vigente) return; setEditarId(data.id); setActivo(data.activo); setPlantelIds(data.plantelIds); setRolesElegidos(data.roles.map((r:{clave:string})=>r.clave)); setForm({email:data.email,nombre:data.nombre,apellidoPaterno:data.apellidoPaterno,apellidoMaterno:data.apellidoMaterno ?? '',telefono:data.telefono ?? '',correoProveedor:data.correoProveedor ?? 'GODADDY'}); }).catch(err=>{if(vigente)setError(mensajeDeError(err));}); return()=>{vigente=false;};
  }, [legado,trabajo.modo,trabajo.id,esSuperadmin]);

  const restablecer = async (e: FormEvent) => {
    e.preventDefault();
    if (!cuentaRestablecer || enviando) return;
    if (passwordTemporal.length < 8) { setError('La contraseña debe cumplir los requisitos de seguridad.'); return; }
    setEnviando(true); setError(''); setMensaje('');
    try {
      const { data } = await api.post<{ mensaje: string }>(`/usuarios/${cuentaRestablecer.usuarioId??cuentaRestablecer.id}/restablecer-password`, { nueva: passwordTemporal });
      setMensaje(data.mensaje);
      setCuentaRestablecer(null); setPasswordTemporal('');
    } catch (err) { setError(mensajeDeError(err)); }
    finally { setEnviando(false); }
  };

  const guardarCorreo = async(e:FormEvent) => {
    e.preventDefault();if(!asignarCorreo||enviando)return;setEnviando(true);setError('');setMensaje('');
    try { const {data}=await api.post(`/usuarios/alumnos/${asignarCorreo.id}/correo-institucional`,{email:nuevoCorreo,correoProveedor:proveedorAlumno});
      setMensaje(data.mensaje);setAsignarCorreo(null);setNuevoCorreo('');await consultar(resultado.pagina,tipo,plantelId,buscar,sinCorreo);
    } catch(e){setError(mensajeDeError(e));}finally{setEnviando(false);}
  };
  const cambiarTipo = (nuevo: Tipo) => {
    setAsignarCorreo(null); setTipo(nuevo); setResultado({ datos: [], total: 0, pagina: 1, porPagina: 10 });
    cargar(1, nuevo, plantelId, buscar);
  };
  const alternarRol = (rol: string) => setRolesElegidos((r) => r.includes(rol) ? r.filter((x) => x !== rol) : [...r, rol]);
  const crear = async (e: FormEvent) => {
    e.preventDefault(); if (enviando) return;
    if (!rolesElegidos.length || (!rolesElegidos.includes('SUPERADMIN') && !plantelIds.length)) { setError('Selecciona al menos un rol y un plantel para personal Administrativo o Finanzas.'); return; }
    setEnviando(true); setError(''); setMensaje('');
    try {
      if (editarId) await api.patch(`/usuarios/${editarId}/personal`, { nombre: form.nombre, apellidoPaterno: form.apellidoPaterno, apellidoMaterno: form.apellidoMaterno, telefono: form.telefono, roles: rolesElegidos, plantelIds, activo, correoProveedor: form.correoProveedor });
      else await api.post('/usuarios', { email: form.email, nombre: form.nombre, apellidoPaterno: form.apellidoPaterno, apellidoMaterno: form.apellidoMaterno, telefono: form.telefono, roles: rolesElegidos, plantelIds: plantelIds.length ? plantelIds : undefined, correoProveedor: form.correoProveedor });
      trabajo.guardado(); if(!legado) trabajo.ir('consulta');
      setMensaje(editarId ? `Cuenta ${form.email} actualizada` : 'Cuenta creada. Si el correo está disponible, recibirá instrucciones para activarla.'); setForm(FORM_INICIAL); setEditarId(null); if(legado) await cargar(1, tipo, plantelId, buscar);
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  return <>
    <Encabezado titulo="Usuarios" detalle="Consulta de alumnos, docentes y personal según tu alcance" />
    {esSuperadmin && (legado || trabajo.modo === 'nuevo' || (trabajo.modo === 'editar' && editarId === trabajo.id)) && <section className="panel"><h2 ref={tituloFormRef} tabIndex={-1}>{editarId ? 'Corregir cuenta de personal' : 'Crear cuenta de personal'}</h2>
      <form onSubmit={crear} aria-busy={enviando}><fieldset disabled={enviando} style={{ border: 0, padding: 0 }}><legend>Datos del personal</legend><div className="fila">
        <div className="campo"><label htmlFor="personal-nombre">Nombre</label><input id="personal-nombre" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
        <div className="campo"><label htmlFor="personal-paterno">Primer apellido</label><input id="personal-paterno" required value={form.apellidoPaterno} onChange={(e) => setForm({ ...form, apellidoPaterno: e.target.value })} /></div>
        <div className="campo"><label htmlFor="personal-correo">Correo</label><input id="personal-correo" type="email" disabled={editarId !== null} required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        
        <div className="campo"><label htmlFor="personal-materno">Segundo apellido</label><input id="personal-materno" maxLength={80} value={form.apellidoMaterno} onChange={(e) => setForm({ ...form, apellidoMaterno: e.target.value })} /></div>
        <div className="campo"><label htmlFor="personal-telefono">Teléfono</label><input id="personal-telefono" type="tel" maxLength={20} value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
        <SelectorProveedorCorreo id="personal-correo-proveedor" value={form.correoProveedor} onChange={(correoProveedor) => setForm({ ...form, correoProveedor })} />
      </div><div className="fila" style={{ marginTop: 12 }}>{ROLES_PERSONAL.map((rol) => <label className="casilla" key={rol}><input type="checkbox" checked={rolesElegidos.includes(rol)} onChange={() => alternarRol(rol)} />{rol}</label>)}<button disabled={enviando} className="boton">{enviando ? 'Guardando…' : editarId ? 'Guardar corrección' : 'Crear'}</button></div><fieldset><legend>Planteles de alcance</legend>{planteles.map((p) => <label key={p.id} className="casilla">
        <input type="checkbox" checked={plantelIds.includes(p.id)} onChange={() => setPlantelIds((ids) => ids.includes(p.id) ? ids.filter((id) => id !== p.id) : [...ids, p.id])} />{p.nombre}
      </label>)}</fieldset>{editarId && <><label><input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />Cuenta activa</label><button type="button" onClick={() => { if (!legado) trabajo.ir('consulta'); else { setEditarId(null); setForm(FORM_INICIAL); } }}>Cancelar edición</button></>}<p>{editarId ? 'El restablecimiento de contraseña se realiza en la acción específica con permisos.' : 'La cuenta se activa mediante una invitación enviada al correo institucional.'} Las correcciones de roles, planteles o acceso revocan las sesiones anteriores.</p></fieldset></form>
    </section>}
    {error && <p className="mensaje-error" role="alert">{error}</p>}{mensaje && <p className="mensaje-ok" role="status">{mensaje}</p>}

    {consultaVisible && <>
    {asignarCorreo&&<section className="panel" aria-label="Asignar correo institucional"><h2 ref={correoTitulo} tabIndex={-1}>Asignar correo institucional: {asignarCorreo.nombre}</h2><p>Vincula una dirección institucional existente. Después se solicitará el código de activación para que el alumno defina su contraseña.</p><form onSubmit={guardarCorreo}><fieldset disabled={enviando}><legend>Acceso del alumno</legend><div className="rejilla-formulario"><div className="campo"><label htmlFor="correo-institucional-alumno">Correo institucional</label><input id="correo-institucional-alumno" required type="email" maxLength={120} value={nuevoCorreo} onChange={e=>setNuevoCorreo(e.target.value)}/></div><SelectorProveedorCorreo id="proveedor-alumno" value={proveedorAlumno} onChange={setProveedorAlumno}/></div><div className="acciones-formulario"><button className="boton">Asignar correo y solicitar activación</button><button type="button" onClick={()=>{setAsignarCorreo(null);origenCorreo.current?.focus();}}>Cancelar</button></div></fieldset></form></section>}
    {cuentaRestablecer && <section className="panel" aria-label="Restablecimiento de contraseña"><h2>Restablecer acceso: {cuentaRestablecer.nombre}</h2><p>La cuenta cerrará sus sesiones y deberá cambiar la contraseña temporal al ingresar.</p><form onSubmit={restablecer}><div className="campo"><label htmlFor="password-temporal-cuenta">Nueva contraseña temporal</label><input id="password-temporal-cuenta" type="password" autoComplete="new-password" required minLength={8} value={passwordTemporal} onChange={(e) => setPasswordTemporal(e.target.value)} /></div><div className="fila"><button className="boton" disabled={enviando}>{enviando ? 'Actualizando…' : 'Restablecer contraseña'}</button><button type="button" className="boton secundario" onClick={() => { setCuentaRestablecer(null); setPasswordTemporal(''); }} disabled={enviando}>Cancelar</button></div></form></section>}

    <div className="fila" style={{ marginBottom: 14 }}>
      {(['ALUMNO', ...(maestroPuro ? [] : ['DOCENTE', 'ADMINISTRATIVO'])] as Tipo[]).map((t) => <button key={t} className={`boton ${tipo === t ? '' : 'secundario'}`} onClick={() => cambiarTipo(t)}>{t === 'ADMINISTRATIVO' ? 'Personal' : t === 'DOCENTE' ? 'Docentes' : 'Alumnos'}</button>)}
    </div>
    <div className="fila" style={{ marginBottom: 14 }}>
      <div className="campo"><label htmlFor="usuarios-plantel">Plantel</label><select id="usuarios-plantel" value={plantelId} onChange={(e) => setPlantelId(e.target.value)}><option value="">Todos</option>{planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
      <div className="campo"><label htmlFor="usuarios-buscar">Buscar</label><input id="usuarios-buscar" value={buscar} onChange={(e) => setBuscar(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && cargar(1, tipo, plantelId, buscar)} /></div>
      {tipo==='ALUMNO'&&puedeRestablecer&&<label className="filtro-casilla"><input type="checkbox" checked={sinCorreo} onChange={e=>{setSinCorreo(e.target.checked);if(e.target.checked && activacionQuery) trabajo.actualizar({sinCorreo:'true',activacionPendiente:'',pagina:'1'}); else void cargar(1,tipo,plantelId,buscar,e.target.checked);}}/>Mostrar alumnos sin correo institucional</label>}
      {!legado && tipo==='ALUMNO' && puedeRestablecer && <label className="filtro-casilla"><input type="checkbox" checked={activacionQuery} onChange={e => trabajo.actualizar({ activacionPendiente: e.target.checked ? 'true' : '', sinCorreo: '', pagina: '1', tipo: 'ALUMNO', vista: 'consulta' })} />Mostrar alumnos con activación pendiente</label>}
      <button className="boton secundario" onClick={() => cargar(1, tipo, plantelId, buscar)}>Aplicar</button>
    </div>

    {cargando && <p role="status">Cargando usuarios…</p>}
    <div className="tabla-contenedor" role="region" aria-label="Listado de usuarios" tabIndex={0}><table className="tabla tabla-adaptable" aria-busy={cargando}><caption className="solo-lector">Identificador, nombre, correo, planteles y estatus de las cuentas visibles</caption><thead><tr><th scope="col">Identificador</th><th scope="col">Nombre</th><th scope="col">Correo</th><th scope="col">Plantel(es)</th><th scope="col">Roles/Estatus</th></tr></thead><tbody>
      {resultado.datos.map((fila) => <tr key={fila.id}><td data-etiqueta="Identificador">{fila.matricula ?? fila.numEmpleado ?? fila.id}</td><td data-etiqueta="Nombre">{fila.nombre}</td><td data-etiqueta="Correo">{fila.correo === null?'Sin correo institucional':fila.correo ?? 'Restringido'}</td><td data-etiqueta="Plantel(es)">{fila.plantel ?? fila.planteles?.join(', ') ?? '—'}</td><td data-etiqueta="Roles/Estatus"><div className="usuarios-celda-acciones"><span className="usuarios-rol">{fila.activacionPendiente && fila.correo ? 'Activación pendiente' : fila.roles?.join(', ') ?? fila.estatus ?? (fila.activo ? 'ACTIVO' : 'INACTIVO')}</span><div className="usuarios-botones">{tipo==='ALUMNO'&&puedeRestablecer&&fila.correo===null&&fila.estatus==='ACTIVO'&&<button type="button" disabled={enviando} onClick={e=>{origenCorreo.current=e.currentTarget;setAsignarCorreo(fila);setNuevoCorreo('');setProveedorAlumno('MICROSOFT365');}}>Asignar correo institucional</button>}{tipo === 'ADMINISTRATIVO' && fila.id !== sesion?.sub && <EliminarRegistro ruta={`/usuarios/${fila.id}`} nombre={`usuario ${fila.nombre}`} deshabilitado={enviando} alEliminar={async () => { setEditarId(null); setForm(FORM_INICIAL); setCuentaRestablecer(null); setPasswordTemporal(''); setMensaje('Cuenta eliminada definitivamente'); await cargar(1, tipo, plantelId, buscar); }} />}{fila.activacionPendiente && fila.correo && <span className="texto-ayuda">El alumno puede solicitar un código desde Activar cuenta con su correo institucional.</span>}{fila.correo!==null && (!fila.activacionPendiente || esSuperadmin) && puedeRestablecer && (esSuperadmin || tipo !== 'ADMINISTRATIVO') && fila.id !== sesion?.sub && <button type="button" className="boton secundario chico" disabled={enviando} onClick={() => { setCuentaRestablecer(fila); setPasswordTemporal(''); setError(''); }}>Restablecer contraseña</button>}{esSuperadmin && tipo === 'ADMINISTRATIVO' && <button disabled={enviando} onClick={async () => { if (!legado) { trabajo.ir('editar',fila.id); return; } try { const { data } = await api.get(`/usuarios/${fila.id}/personal`); setEditarId(data.id); setActivo(data.activo); setPlantelIds(data.plantelIds); setRolesElegidos(data.roles.map((r: { clave: string }) => r.clave)); setForm({ email: data.email, nombre: data.nombre, apellidoPaterno: data.apellidoPaterno, apellidoMaterno: data.apellidoMaterno ?? '', telefono: data.telefono ?? '', correoProveedor: data.correoProveedor ?? 'GODADDY' }); } catch (err) { setError(mensajeDeError(err)); } }}>Corregir cuenta</button>}</div></div></td></tr>)}
      {!cargando && !resultado.datos.length && <tr><td className="vacio" colSpan={5}>Sin resultados.</td></tr>}
    </tbody></table></div>
    <Paginador total={resultado.total} pagina={resultado.pagina} porPagina={resultado.porPagina} deshabilitado={cargando} onCambio={(pagina) => cargar(pagina, tipo, plantelId, buscar)} />
    </>}
  </>;
}
