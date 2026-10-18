import { useModuloTrabajo } from '../components/ModuloTrabajo';
import { Paginador } from '../components/Paginador';
import { EliminarRegistro } from '../components/EliminarRegistro';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Encabezado } from '../components/Encabezado';
import '../components/tabla-adaptable.css';

interface Plantel {
  id: number; clave: string; nombre: string; direccion?: string; municipio?: string;
  telefono?: string; activo: boolean;
}
interface Detalle extends Plantel {
  director: { id: number; nombre: string; apellidoPaterno: string; email: string } | null;
  personal: Array<{ id: number; nombre: string; email: string; roles: string[] }>;
  conteos: { alumnos: number; grupos: number };
}

export default function PlantelesPage() {
  const { sesion } = useAuth();
  const esSuperadmin = sesion?.roles.includes('SUPERADMIN') ?? false;
  const puedeAdministrar = esSuperadmin || (sesion?.roles.includes('ADMINISTRATIVO') ?? false);
  const [planteles, setPlanteles] = useState<Plantel[]>([]);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [alta, setAlta] = useState({ clave: '', nombre: '', direccion: '', municipio: '', telefono: '' });
  const [edicion, setEdicion] = useState<{ id: number; nombre: string; direccion: string; municipio: string; telefono: string; activo: boolean } | null>(null);
  const [directorEmail, setDirectorEmail] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const trabajo = useModuloTrabajo(guardando), legado = trabajo.modo === 'legado', consultaVisible = legado || trabajo.modo === 'consulta';
  const pagina = Math.max(1,Number(trabajo.query.get('pagina')) || 1), buscar = trabajo.query.get('buscar') || '';
  const [termino,setTermino] = useState(buscar), [total,setTotal] = useState(0);
  const consulta = useRef(0);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const consultaDetalle = useRef(0);

  const cargar = useCallback(async () => {
    setCargando(true);
    const actual = ++consulta.current;
    try { if(legado) { const {data}=await api.get<Plantel[]>('/planteles'); if(actual===consulta.current) {setPlanteles(data);setTotal(data.length);} }
      else { const {data}=await api.get<{datos:Plantel[];total:number}>('/planteles/listado',{params:{pagina,porPagina:10,buscar}}); if(actual===consulta.current){setPlanteles(data.datos);setTotal(data.total);} }
    } catch(err) { if(actual===consulta.current)setError(mensajeDeError(err)); }
    finally { if(actual===consulta.current)setCargando(false); }
  }, [legado,pagina,buscar]);
  const seleccionar = async (id: number) => {
    const actual = ++consultaDetalle.current;
    setError(''); setDetalle(null); setCargandoDetalle(true);
    setDirectorEmail(''); setPersonalEmail('');
    setEdicion(null);
    try {
      const { data } = await api.get<Detalle>(`/planteles/${id}`);
      if (actual === consultaDetalle.current) setDetalle(data);
    } catch (err) { if (actual === consultaDetalle.current) setError(mensajeDeError(err)); }
    finally { if (actual === consultaDetalle.current) setCargandoDetalle(false); }
  };
  useEffect(() => {
    if(consultaVisible) void cargar();
    return () => { consultaDetalle.current += 1; consulta.current++; };
  }, [cargar,consultaVisible]);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true); setError(''); setMensaje('');
    try {
      const { data } = await api.post<Plantel>('/planteles', {
        ...alta,
        direccion: alta.direccion || undefined,
        municipio: alta.municipio || undefined,
        telefono: alta.telefono || undefined,
      });
      trabajo.guardado(); if(!legado) trabajo.ir('detalle',data.id);
      setAlta({ clave: '', nombre: '', direccion: '', municipio: '', telefono: '' });
      setMensaje('Plantel creado. Revisa el detalle y asigna director y personal.'); await cargar(); await seleccionar(data.id);
    } catch (err) { setError(mensajeDeError(err)); }
    finally { setGuardando(false); }
  };

  const comenzarEdicion = (plantel: Plantel) => {
    if (!esSuperadmin || guardando) return;
    setError(''); setMensaje('');
    if(!legado) trabajo.ir('editar',plantel.id);
    setEdicion({
      id: plantel.id,
      nombre: plantel.nombre,
      direccion: plantel.direccion ?? '',
      municipio: plantel.municipio ?? '',
      telefono: plantel.telefono ?? '',
      activo: plantel.activo,
    });
  };

  const guardarEdicion = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!edicion || !esSuperadmin || guardando) return;
    setGuardando(true); setError(''); setMensaje('');
    const { id, nombre, direccion, municipio, telefono, activo } = edicion;
    try {
      await api.patch(`/planteles/${id}`, {
        nombre: nombre.trim(), direccion: direccion.trim(),
        municipio: municipio.trim(), telefono: telefono.trim(), activo,
      });
      trabajo.guardado(); if(!legado) trabajo.ir('consulta');
      if(legado) { await cargar(); await seleccionar(id); }
      setMensaje('Datos del plantel actualizados.');
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  };

  useEffect(() => {
    if(legado || !trabajo.id || !['editar','detalle'].includes(trabajo.modo)) return;
    let vigente = true;
    if(trabajo.modo === 'detalle') { void seleccionar(trabajo.id); return; }
    if(!esSuperadmin) return;
    api.get<Plantel>(`/planteles/${trabajo.id}`).then(({data:p})=>{if(vigente)setEdicion({id:p.id,nombre:p.nombre,direccion:p.direccion || '',municipio:p.municipio || '',telefono:p.telefono || '',activo:p.activo});}).catch(err=>{if(vigente)setError(mensajeDeError(err));});
    return()=>{vigente=false;};
    // seleccionar limpia el detalle antes de cada consulta y descarta respuestas antiguas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trabajo.id,trabajo.modo,legado,esSuperadmin]);
  useEffect(()=>{setTermino(buscar);},[buscar]);
  const operar = async (accion: () => Promise<unknown>, texto: string) => {
    if (!detalle || guardando) return;
    setGuardando(true); setError(''); setMensaje('');
    try { await accion(); setMensaje(texto); await seleccionar(detalle.id); }
    catch (err) { setError(mensajeDeError(err)); }
    finally { setGuardando(false); }
  };

  return <>
    <Encabezado titulo="Planteles" detalle="Datos, dirección y personal asignado por sede" />
    {error && <p role="alert" className="mensaje-error">{error}</p>}
    {mensaje && <p role="status" className="mensaje-ok">{mensaje}</p>}

    {esSuperadmin && (legado || trabajo.modo === 'nuevo') && <section className="panel">
      <h2>Nuevo plantel</h2>
      <p className="texto-ayuda" id="ayuda-nuevo-plantel">Paso 1: registra la sede. Después selecciona el plantel para vincular su director y personal. Los alumnos se inscriben en grupos desde Control escolar.</p>
      <form className="fila" onSubmit={crear} aria-busy={guardando} aria-describedby="ayuda-nuevo-plantel">
        <div className="campo"><label htmlFor="nuevo-plantel-clave">Clave</label><input id="nuevo-plantel-clave" required minLength={2} maxLength={10} value={alta.clave} onChange={(e) => setAlta({ ...alta, clave: e.target.value.toUpperCase() })} /></div>
        <div className="campo"><label htmlFor="nuevo-plantel-nombre">Nombre</label><input id="nuevo-plantel-nombre" required minLength={3} value={alta.nombre} onChange={(e) => setAlta({ ...alta, nombre: e.target.value })} /></div>
        <div className="campo"><label htmlFor="nuevo-plantel-municipio">Municipio</label><input id="nuevo-plantel-municipio" value={alta.municipio} onChange={(e) => setAlta({ ...alta, municipio: e.target.value })} /></div>
        <div className="campo"><label htmlFor="nuevo-plantel-direccion">Dirección</label><input id="nuevo-plantel-direccion" value={alta.direccion} onChange={(e) => setAlta({ ...alta, direccion: e.target.value })} /></div>
        <div className="campo"><label htmlFor="nuevo-plantel-telefono">Teléfono</label><input id="nuevo-plantel-telefono" value={alta.telefono} onChange={(e) => setAlta({ ...alta, telefono: e.target.value })} /></div>
        <button className="boton" disabled={guardando}>{guardando ? 'Guardando…' : 'Crear'}</button>
      </form>
    </section>}

    {consultaVisible && <section className="panel">
      {!legado && <form className="fila" onSubmit={e=>{e.preventDefault();trabajo.actualizar({buscar:termino.trim(),pagina:'1'});}}><label>Buscar por clave o nombre<input value={termino} onChange={e=>setTermino(e.target.value)} /></label><button>Buscar</button></form>}
      <div className="cabecera-listado"><h2>Directorio de planteles</h2><p>{total} planteles</p></div>
      {cargando && <p role="status">Cargando planteles…</p>}
      <div className="tabla-contenedor" role="region" aria-label="Listado de planteles" tabIndex={0}>
        <table className="tabla tabla-adaptable" aria-busy={cargando}>
          <caption className="solo-lector">ID de importación, clave, nombre, municipio, estatus y acciones por plantel</caption>
          <thead><tr><th scope="col">ID</th><th scope="col">Clave</th><th scope="col">Nombre</th><th scope="col">Municipio</th><th scope="col">Estatus</th><th scope="col">Acciones</th></tr></thead>
          <tbody>
            {planteles.map((p) => <tr key={p.id}>
              <td data-etiqueta="ID"><code>{p.id}</code></td>
              <td data-etiqueta="Clave">{p.clave}</td>
              <td data-etiqueta="Nombre">{p.nombre}</td>
              <td data-etiqueta="Municipio">{p.municipio ?? '—'}</td>
              <td data-etiqueta="Estatus"><span className={`sello ${p.activo ? 'ok' : 'neutro'}`}>{p.activo ? 'Activo' : 'Inactivo'}</span></td>
              <td data-etiqueta="Acciones" className="derecha"><span className="acciones-fila"><EliminarRegistro ruta={`/planteles/${p.id}`} nombre={`plantel ${p.clave}`} deshabilitado={guardando} alEliminar={async () => { consultaDetalle.current++; setDetalle(null); setEdicion(null); setCargandoDetalle(false); setMensaje('Plantel eliminado definitivamente'); await cargar(); }} /><button className="boton secundario chico" disabled={guardando} onClick={() => {if(legado) void seleccionar(p.id); else trabajo.ir('detalle',p.id);}}>Ver detalle</button>{esSuperadmin && <button type="button" className="boton secundario chico" disabled={guardando} onClick={() => comenzarEdicion(p)}>Editar</button>}</span></td>
            </tr>)}
            {!cargando && planteles.length === 0 && <tr><td colSpan={6} className="vacio">No hay planteles disponibles para tu cuenta. Si tienes permisos de superadministración, puedes registrar el primero.</td></tr>}
          </tbody>
        </table>
      </div>
      {!legado && <Paginador total={total} pagina={pagina} porPagina={10} deshabilitado={cargando} onCambio={p=>trabajo.actualizar({pagina:String(p)})} />}
    </section>}

    {esSuperadmin && (legado || (trabajo.modo === 'editar' && edicion?.id === trabajo.id)) && edicion && <section className="panel" aria-labelledby="titulo-editar-plantel">
      <h2 id="titulo-editar-plantel">Editar plantel: {planteles.find((p) => p.id === edicion.id)?.clave}</h2>
      <p className="texto-ayuda">Puedes corregir nombre, ubicación, teléfono y estatus. La clave institucional y el ID no se modifican. Para desactivar un plantel primero deben liberarse sus alumnos, grupos y personal activos.</p>
      <form className="fila" onSubmit={guardarEdicion} aria-busy={guardando}>
        <div className="campo"><label htmlFor="editar-plantel-nombre">Nombre del plantel</label><input id="editar-plantel-nombre" required minLength={3} maxLength={120} disabled={guardando} value={edicion.nombre} onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })} /></div>
        <div className="campo"><label htmlFor="editar-plantel-direccion">Dirección</label><input id="editar-plantel-direccion" maxLength={200} disabled={guardando} value={edicion.direccion} onChange={(e) => setEdicion({ ...edicion, direccion: e.target.value })} /></div>
        <div className="campo"><label htmlFor="editar-plantel-municipio">Municipio</label><input id="editar-plantel-municipio" maxLength={80} disabled={guardando} value={edicion.municipio} onChange={(e) => setEdicion({ ...edicion, municipio: e.target.value })} /></div>
        <div className="campo"><label htmlFor="editar-plantel-telefono">Teléfono</label><input id="editar-plantel-telefono" maxLength={20} disabled={guardando} value={edicion.telefono} onChange={(e) => setEdicion({ ...edicion, telefono: e.target.value })} /></div>
        <div className="campo"><label htmlFor="editar-plantel-activo">Estatus</label><select id="editar-plantel-activo" disabled={guardando} value={edicion.activo ? 'activo' : 'inactivo'} onChange={(e) => setEdicion({ ...edicion, activo: e.target.value === 'activo' })}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></div>
        <button type="submit" className="boton" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
        <button type="button" className="boton secundario" disabled={guardando} onClick={() => { if(legado) setEdicion(null); else trabajo.ir('consulta'); }}>Cancelar</button>
      </form>
    </section>}

    {cargandoDetalle && <p role="status">Cargando detalle del plantel…</p>}
    {(legado || trabajo.modo === 'detalle') && detalle && <section className="panel">
      <h2>{detalle.nombre}</h2>
      <p className="detalle">{detalle.direccion || 'Sin dirección'} · {detalle.municipio || 'Sin municipio'} · {detalle.telefono || 'Sin teléfono'}</p>
      <div className="fila"><span className="sello neutro">{detalle.conteos.alumnos} alumnos</span><span className="sello neutro">{detalle.conteos.grupos} grupos</span></div>
      <section aria-label="Preparación del plantel">
        <h3>Pasos de configuración</h3>
        <ol>
          <li>Plantel registrado: <strong>{detalle.clave}</strong>.</li>
          <li>{detalle.director ? 'Director asignado.' : 'Asigna un director cuando tengas su cuenta creada.'}</li>
          <li>{detalle.personal.length ? 'Personal vinculado al plantel.' : 'Vincula personal autorizado para gestionar esta sede.'}</li>
          <li>Después configura ciclos, materias y grupos; registra e inscribe alumnos en sus grupos.</li>
        </ol>
        <p className="texto-ayuda">La creación del expediente del alumno no equivale a inscribirlo en un grupo.</p>
        {puedeAdministrar && <nav aria-label="Siguientes pasos del plantel" className="fila">{esSuperadmin && <a className="boton secundario" href="/usuarios">Crear o ubicar personal</a>}<a className="boton secundario" href="/materias">Configurar ciclos y materias</a><a className="boton secundario" href="/grupos">Preparar grupos e inscripciones</a></nav>}
      </section>
      <h3>Director</h3>
      <p>{detalle.director ? `${detalle.director.nombre} ${detalle.director.apellidoPaterno} · ${detalle.director.email}` : 'Sin director asignado'}</p>
      {puedeAdministrar && <div className="fila"><div className="campo"><label htmlFor="correo-director-plantel">Correo del director</label><input id="correo-director-plantel" type="email" value={directorEmail} onChange={(e) => setDirectorEmail(e.target.value)} /></div><button className="boton" disabled={guardando || !directorEmail.trim()} onClick={() => operar(() => api.put(`/planteles/${detalle.id}/director`, { email: directorEmail }), 'Director actualizado')}>Asignar director</button></div>}
      <h3>Personal asignado</h3>
      {puedeAdministrar && <div className="fila"><div className="campo"><label htmlFor="correo-personal-plantel">Correo del personal</label><input id="correo-personal-plantel" type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} /></div><button className="boton" disabled={guardando || !personalEmail.trim()} onClick={() => operar(() => api.post(`/planteles/${detalle.id}/personal`, { email: personalEmail }), 'Personal agregado')}>Agregar</button></div>}
      <div className="tabla-contenedor" role="region" aria-label="Personal del plantel" tabIndex={0}>
        <table className="tabla tabla-adaptable">
          <caption className="solo-lector">Personal asignado al plantel, correo, roles y opciones</caption>
          <thead><tr><th scope="col">Nombre</th><th scope="col">Correo</th><th scope="col">Roles</th><th scope="col">Acciones</th></tr></thead>
          <tbody>
            {detalle.personal.map((p) => <tr key={p.id}>
              <td data-etiqueta="Nombre">{p.nombre}</td>
              <td data-etiqueta="Correo">{p.email}</td>
              <td data-etiqueta="Roles">{p.roles.join(', ')}</td>
              <td data-etiqueta="Acciones" className="derecha">{puedeAdministrar && <span className="acciones-fila"><button className="boton peligro chico" disabled={guardando} onClick={() => operar(() => api.delete(`/planteles/${detalle.id}/personal/${p.id}`), 'Personal retirado')}>Quitar</button></span>}</td>
            </tr>)}
            {detalle.personal.length === 0 && <tr><td className="vacio" colSpan={4}>No hay personal asignado a este plantel.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>}
  </>;
}
