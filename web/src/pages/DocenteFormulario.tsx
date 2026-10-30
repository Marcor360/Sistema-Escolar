import { validarIdentidadPersonal } from '../utils/identidad-personal';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useBeforeUnload, useBlocker, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, mensajeDeError } from '../api/client';
import { SelectorProveedorCorreo, type ProveedorCorreo } from '../components/SelectorProveedorCorreo';
import { useConfirmacion } from '../components/useConfirmacion';

const FORM_INICIAL = {
  numEmpleado: '', nombre: '', segundoNombre: '', apellidoPaterno: '', apellidoMaterno: '', telefono: '',
  cedulaProfesional: '', email: '', cedulaPendiente: false, especialidad: '', correoProveedor: 'GODADDY' as ProveedorCorreo,
};
interface Docente {
  numEmpleado: string; especialidad?: string; cedulaProfesional?: string;
  usuario: { nombre: string; segundoNombre?: string | null; apellidoPaterno: string; apellidoMaterno?: string; telefono?: string; email: string; correoProveedor?: ProveedorCorreo };
}

export default function DocenteFormulario() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState(FORM_INICIAL), [base, setBase] = useState(FORM_INICIAL);
  const [planteles, setPlanteles] = useState<{ id: number; nombre: string }[]>([]);
  const [plantelIds, setPlantelIds] = useState<number[]>([]);
  const [falloCarga, setFalloCarga] = useState(false);
  const [error, setError] = useState(''), [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false), [intento, setIntento] = useState(0);
  const mutando = useRef(false), guardado = useRef(false), titulo = useRef<HTMLHeadingElement>(null);
  const confirmacion = useConfirmacion();
  const solicitar = useRef(confirmacion.solicitar); solicitar.current = confirmacion.solicitar;
  const sucio = JSON.stringify(form) !== JSON.stringify(base) || (!editando && plantelIds.length > 0);
  const bloqueo = useBlocker(() => !guardado.current && (sucio || mutando.current));
  useBeforeUnload(useCallback((evento) => {
    if (!guardado.current && (sucio || mutando.current)) { evento.preventDefault(); evento.returnValue = ''; }
  }, [sucio]));
  useEffect(() => {
    if (bloqueo.state !== 'blocked') return;
    if (mutando.current) { bloqueo.reset(); return; }
    let activo = true;
    void solicitar.current('¿Salir sin guardar los cambios del docente?').then((aceptado) => {
      if (!activo) return;
      if (aceptado) bloqueo.proceed(); else bloqueo.reset();
    });
    return () => { activo = false; };
  }, [bloqueo]);
  useEffect(() => {
    let activo = true;
    setCargando(true); setError(''); setFalloCarga(false);
    const cargar = async () => {
      try {
        if (id) {
          const { data: d } = await api.get<Docente>(`/docentes/${id}`);
          if (!activo) return;
          const datos = { ...FORM_INICIAL, numEmpleado: d.numEmpleado, nombre: d.usuario.nombre, segundoNombre: d.usuario.segundoNombre ?? '',
            apellidoPaterno: d.usuario.apellidoPaterno, apellidoMaterno: d.usuario.apellidoMaterno ?? '',
            telefono: d.usuario.telefono ?? '', email: d.usuario.email, especialidad: d.especialidad ?? '',
            cedulaProfesional: d.cedulaProfesional ?? '', cedulaPendiente: !d.cedulaProfesional, correoProveedor: d.usuario.correoProveedor ?? 'GODADDY' };
          setForm(datos); setBase(datos);
        } else {
          const { data } = await api.get('/planteles/mios');
          if (activo) setPlanteles(data);
        }
      } catch (err) { if (activo) { setError(mensajeDeError(err)); setFalloCarga(true); } }
      finally { if (activo) setCargando(false); }
    };
    void cargar();
    titulo.current?.focus();
    return () => { activo = false; };
  }, [id, intento]);
  const retorno = `/docentes${location.search}`;
  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (mutando.current || cargando) return;
    const errorIdentidad = validarIdentidadPersonal(form);
    if (errorIdentidad) { setError(errorIdentidad); return; }
    mutando.current = true; setEnviando(true); setError('');
    try {
      if (id) await api.patch(`/docentes/${id}`, { nombre: form.nombre.trim(), segundoNombre: form.segundoNombre.trim() || null, apellidoPaterno: form.apellidoPaterno,
        apellidoMaterno: form.apellidoMaterno, telefono: form.telefono, correoProveedor: form.correoProveedor,
        cedulaProfesional: form.cedulaPendiente ? null : form.cedulaProfesional, especialidad: form.especialidad });
      else await api.post('/docentes', { ...form, plantelIds,
        cedulaProfesional: form.cedulaPendiente ? undefined : form.cedulaProfesional, especialidad: form.especialidad || undefined });
      guardado.current = true;
      const query = new URLSearchParams(location.search); query.set('vista', 'consulta');
      navigate(`/docentes?${query}`, { replace: true, state: { mensaje: editando ? 'Docente actualizado' : 'Docente registrado. Se solicitó invitación a su correo institucional.' } });
    } catch (err) { setError(mensajeDeError(err)); }
    finally { mutando.current = false; setEnviando(false); }
  };
  const dar = (campo: Exclude<keyof typeof FORM_INICIAL, 'cedulaPendiente'>) => ({
    value: form[campo], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [campo]: e.target.value }),
  });
  return <main className="contenido edicion-enfocada" id="contenido-principal">
    {confirmacion.elemento}
    <header className="encabezado"><h1 ref={titulo} tabIndex={-1}>{editando ? 'Editar docente' : 'Registrar docente'}</h1>
      <p>Datos del expediente docente. {editando ? 'El número de empleado y el correo se conservan.' : 'Se enviará una invitación al correo institucional.'}</p></header>
    <button type="button" className="boton secundario" disabled={enviando} onClick={() => navigate(retorno)}>Cancelar y volver</button>
    {cargando && <p role="status">Cargando expediente…</p>}
    {error && <p role="alert" className="mensaje-error">{error}</p>}
    {!cargando && falloCarga && <button type="button" disabled={enviando} onClick={() => setIntento((v) => v + 1)}>Reintentar carga</button>}
    {!cargando && <form id="form-docente" className="panel" onSubmit={guardar} aria-busy={enviando}>
      <fieldset disabled={enviando || (editando && !form.numEmpleado)}><legend>Datos del docente</legend><p className="texto-ayuda">Captura nombre, segundo nombre si existe, ambos apellidos y después el correo.</p>
        <div className="rejilla-formulario">
          <div className="campo"><label htmlFor="doc-empleado">Núm. empleado</label><input id="doc-empleado" disabled={editando} required maxLength={20} {...dar('numEmpleado')} /></div>
          <div className="campo"><label htmlFor="doc-nombre">Nombre *</label><input id="doc-nombre" required maxLength={80} autoComplete="given-name" {...dar('nombre')} /></div>
          <div className="campo"><label htmlFor="doc-segundo-nombre">Segundo nombre (opcional)</label><input id="doc-segundo-nombre" maxLength={80} {...dar('segundoNombre')} /></div>
          <div className="campo"><label htmlFor="doc-paterno">Primer apellido *</label><input id="doc-paterno" required maxLength={80} {...dar('apellidoPaterno')} /></div>
          <div className="campo"><label htmlFor="doc-materno">Segundo apellido *</label><input id="doc-materno" required maxLength={80} {...dar('apellidoMaterno')} /></div>
          <div className="campo"><label htmlFor="doc-email">Correo institucional *</label><input id="doc-email" type="email" disabled={editando} required maxLength={120} {...dar('email')} /></div>
          <div className="campo"><label htmlFor="doc-telefono">Teléfono</label><input id="doc-telefono" type="tel" maxLength={20} {...dar('telefono')} /></div>
          <SelectorProveedorCorreo id="doc-correo-proveedor" value={form.correoProveedor} onChange={(correoProveedor) => setForm({ ...form, correoProveedor })} />
          <div className="campo"><label htmlFor="doc-especialidad">Especialidad</label><input id="doc-especialidad" maxLength={120} {...dar('especialidad')} /></div>
          <div className="campo"><label htmlFor="doc-cedula">Cédula profesional</label><input id="doc-cedula" required={!form.cedulaPendiente} disabled={form.cedulaPendiente} maxLength={20} {...dar('cedulaProfesional')} /></div>
          <label className="casilla"><input type="checkbox" checked={form.cedulaPendiente} onChange={(e) => setForm({ ...form, cedulaPendiente: e.target.checked, cedulaProfesional: e.target.checked ? '' : form.cedulaProfesional })} />Cédula pendiente de capturar</label>
        </div>
      </fieldset>
      {!editando && <fieldset disabled={enviando}><legend>Planteles para el alta (obligatorios)</legend>
        {planteles.map((p) => <label className="casilla" key={p.id}><input type="checkbox" required={plantelIds.length === 0} checked={plantelIds.includes(p.id)} onChange={() => setPlantelIds((ids) => ids.includes(p.id) ? ids.filter((valor) => valor !== p.id) : [...ids, p.id])} />{p.nombre}</label>)}
        {!planteles.length && <p>No hay planteles disponibles. Revisa tus asignaciones antes de registrar.</p>}
      </fieldset>}
      <button className="boton" disabled={enviando || (!editando && !plantelIds.length) || (editando && !form.numEmpleado)}>{enviando ? 'Guardando…' : 'Guardar docente'}</button>
    </form>}
  </main>;
}
