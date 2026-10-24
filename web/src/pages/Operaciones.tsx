import { useModuloTrabajo } from '../components/ModuloTrabajo';
import { useConfirmacion } from '../components/useConfirmacion';
import { BitacoraAcademica } from '../components/BitacoraAcademica';
import { FormEvent, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';
import { SelectorBuscable } from '../components/SelectorBuscable';
import { useAuth } from '../auth/AuthContext';
import '../components/tabla-adaptable.css';
interface Grupo { id: number; nombre: string; ciclo: { clave: string }; plantel: { nombre: string } }
interface PreviewImport { previewId: string | null; registros: number; validos: number; duplicados: { fila: number; mensaje: string }[]; errores: { fila: number; mensaje: string }[]; regla: string; identificadores: { fila: number; identificador: string }[] }
interface PreviewPromocion { origen: { nombre: string }; destino: { nombre: string }; plantel: string; regla: string; alumnos: { id: number; nombre: string; matricula: string; elegible: boolean }[] }
export default function OperacionesPage() {
  const confirmacion = useConfirmacion();
  const { tieneRol } = useAuth();
  const soloFinanzas = tieneRol('FINANZAS') && !tieneRol('SUPERADMIN', 'ADMINISTRATIVO');
  const tiposDisponibles = soloFinanzas ? ['ALUMNOS'] : [...(tieneRol('SUPERADMIN') ? ['ALUMNOS', 'DOCENTES', 'INSCRIPCIONES', 'PERSONAL'] : ['DOCENTES', 'INSCRIPCIONES'])];
  const [tipo, setTipo] = useState(soloFinanzas ? 'ALUMNOS' : tiposDisponibles[0]); const [archivo, setArchivo] = useState<File | null>(null); const [preview, setPreview] = useState<PreviewImport | null>(null);
  const [ciclos, setCiclos] = useState<{ id: number; clave: string; estado: string }[]>([]); const [cicloOrigen, setCicloOrigen] = useState(''); const [cicloDestino, setCicloDestino] = useState('');
  const [origen, setOrigen] = useState(''); const [destino, setDestino] = useState(''); const [promocion, setPromocion] = useState<PreviewPromocion | null>(null); const [elegidos, setElegidos] = useState<number[]>([]);
  const [enviando, setEnviando] = useState(false); const [etapa, setEtapa] = useState(''); const [error, setError] = useState(''); const [mensaje, setMensaje] = useState('');
  const trabajo=useModuloTrabajo(enviando),legado=trabajo.modo==='legado';
  useEffect(() => { if(!legado && trabajo.modo !== 'promover') return; let vigente=true; api.get('/academico/ciclos').then(({data})=>{if(vigente)setCiclos(data);}).catch(err=>{if(vigente)setError(mensajeDeError(err));});return()=>{vigente=false;}; }, [legado,trabajo.modo]);
  const operar = async (fn: () => Promise<void>) => { if (enviando) return; setEnviando(true); setError(''); setMensaje(''); try { await fn(); } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); setEtapa(''); } };
  const guardarArchivo = (blob: Blob, nombre: string) => { const url = URL.createObjectURL(blob); const enlace = document.createElement('a'); enlace.href = url; enlace.download = nombre; enlace.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const descargarErrores = async (id: string) => {
    const { data } = await api.get<Blob>(`/importaciones/correcciones/${id}`, { responseType: 'blob' });
    guardarArchivo(data, 'alumnos_para_corregir.xlsx');
  };
  const previsualizar = (e: FormEvent) => {
    e.preventDefault();
    if (!archivo) return;
    if (!/\.(csv|xlsx)$/i.test(archivo.name)) {
      setError('Selecciona un archivo CSV o Excel XLSX.'); setPreview(null); return;
    }
    if (!archivo.size || archivo.size > 5 * 1024 * 1024) {
      setError('El archivo debe contener datos y pesar como máximo 5 MB.'); setPreview(null); return;
    }
    setEtapa('Validando filas y comparando alumnos existentes…');
    void operar(async () => {
      const form = new FormData();
      form.append('tipo', tipo); form.append('archivo', archivo);
      const { data } = await api.post<PreviewImport>('/importaciones/preview', form);
      setPreview(data);
    });
  };
  const plantilla = () => { void operar(async () => { const { data } = await api.get<Blob>('/importaciones/plantilla', { params: { tipo }, responseType: 'blob' }); guardarArchivo(data, `plantilla_${tipo.toLowerCase()}.xlsx`); }); };
  return <>{confirmacion.elemento}<Encabezado titulo="Operaciones académicas masivas" detalle="Previsualizar y confirmar. Alumnos nuevos válidos se registran; existentes se omiten y filas incorrectas se descargan para corregir." />
    {error && <p role="alert" className="mensaje-error">{error}</p>}{mensaje && <p role="status">{mensaje}</p>}{enviando && <p role="status" aria-live="polite">{etapa || 'Procesando solicitud…'} Puedes seguir utilizando otras secciones; evita repetir la importación hasta recibir la confirmación.</p>}
    {(legado || trabajo.modo==='importar') && <section className="panel"><h2>Importación CSV / Excel</h2><p><a href="/calificaciones">Ir a la importación de calificaciones</a></p><p className="texto-ayuda">1. Descarga la plantilla del tipo elegido. 2. Complétala sin fórmulas. 3. Adjunta el archivo. 4. Revisa los errores antes de confirmar. Esta importación es de expedientes, docentes, personal e inscripciones; la carga de calificaciones se realiza desde la sección Calificaciones, con su propia plantilla y confirmación.</p><p>Para completar <code>plantelId</code>, <code>plantelIds</code> o <code>grupoId</code>, consulta la columna ID en <a href="/planteles">Planteles</a> o <a href="/grupos">Grupos</a>. Son identificadores numéricos, no la clave o el nombre visible.</p><p>Máximo 500 registros y 5 MB. Planteles y roles múltiples se separan con punto y coma. No incluyas contraseñas. Para ALUMNOS son obligatorios el correo institucional (de acceso), nombres, apellido paterno, matrícula, CURP y plantel. La columna correoPersonal es opcional y se guarda como contacto; correoProveedor permite elegir por alumno Microsoft 365 o GoDaddy, y debe seleccionarse obligatoriamente en cada fila. El primer nombre es obligatorio y el segundo nombre opcional. Elige el servicio que puede entregar a ese buzón. La matrícula no es una contraseña. El alumno solicita un código de activación por correo institucional y establece su propia contraseña; sin correo operativo el acceso permanece pendiente. Para DOCENTES y PERSONAL se mantiene la activación por recuperación de correo (requiere SMTP).</p>
      <label htmlFor="tipo-importacion">Tipo</label><select id="tipo-importacion" disabled={enviando} value={tipo} onChange={(e) => { setTipo(e.target.value); setArchivo(null); setPreview(null); setError(''); }}>{tiposDisponibles.map((t) => <option key={t}>{t}</option>)}</select><button disabled={enviando} onClick={plantilla}>Descargar plantilla</button>
      <form onSubmit={previsualizar}><label htmlFor="archivo-importacion">Archivo</label><input key={tipo} id="archivo-importacion" type="file" required accept=".csv,.xlsx" disabled={enviando} onChange={(e) => { setArchivo(e.target.files?.[0] ?? null); setPreview(null); }} /><button className="boton" disabled={enviando || !archivo}>Previsualizar archivo</button></form>
      {preview && <section aria-label="Resultado de la previsualización" aria-busy={enviando}>
        <h3>Resultado de {preview.registros} registros</h3>
        <p role="status"><strong>{preview.validos} nuevos válidos</strong> · {preview.duplicados.length} ya registrados o repetidos · {preview.errores.length} requieren corrección.</p>
        <p className="texto-ayuda">{preview.regla}</p>
        {preview.duplicados.length > 0 && <details><summary>{preview.duplicados.length} alumnos no se importarán porque ya existen o están repetidos</summary>
          {preview.duplicados.map((d) => <p key={d.fila}>Fila {d.fila}: {d.mensaje}</p>)}
        </details>}
        {preview.errores.length > 0 && <section aria-label="Alumnos por corregir">
          <h4>Registros con errores</h4>
          {preview.errores.map((e) => <p key={e.fila} role="alert">Fila {e.fila}: {e.mensaje}</p>)}
          <p>Descarga una plantilla con solo estas filas. La hoja «Errores» explica qué corregir. Los alumnos ya registrados no aparecerán allí.</p>
          <button type="button" disabled={enviando || !preview.previewId} onClick={() => { if (!preview.previewId) return;
            setEtapa('Preparando Excel de correcciones…');
            void operar(async () => { await descargarErrores(preview.previewId!); });
          }}>Descargar únicamente alumnos por corregir</button>
        </section>}
        {preview.validos > 0 && <><div className="tabla-contenedor" role="region" aria-label="Filas de previsualización" tabIndex={0}>
          <table className="tabla tabla-adaptable"><thead><tr><th scope="col">Fila</th><th scope="col">Identificador</th></tr></thead><tbody>
            {preview.identificadores.map((i) => <tr key={i.fila}><td data-etiqueta="Fila">{i.fila}</td><td data-etiqueta="Identificador">{i.identificador}</td></tr>)}
          </tbody></table></div>
          <button type="button" disabled={enviando || !preview.previewId} onClick={async () => {
            if (!preview.previewId || !await confirmacion.solicitar(`¿Importar ${preview.validos} alumnos nuevos? Los existentes y los incorrectos se omitirán.`)) return;
            const id = preview.previewId;
            setEtapa('Importando únicamente alumnos nuevos y válidos…');
            void operar(async () => {
              if (tipo === 'ALUMNOS' && preview.errores.length > 0) await descargarErrores(id);
              const { data } = await api.post<{ total: number; insertados: number; existentes: number; rechazados: number; activacion: string | null }>(
                '/importaciones/confirmar', { previewId: id, confirmado: true });
              trabajo.guardado();
              setMensaje(`Archivo de ${data.total} registros: ${data.insertados} alumnos nuevos importados, ${data.existentes} ya registrados, ${data.rechazados} por corregir. ${data.activacion || ''}`);
              setPreview(null);
            });
          }}>Importar {preview.validos} alumnos nuevos</button></>}
      </section>}
    </section>}
    {!soloFinanzas && (legado || trabajo.modo==='promover') && <section className="panel"><h2>Promoción al siguiente ciclo</h2><p>Selecciona un grupo de ciclo cerrado y un destino de ciclo en preparación, dentro del mismo plantel.</p>
      <label htmlFor="ciclo-origen-promocion">Ciclo cerrado de origen</label><select id="ciclo-origen-promocion" required value={cicloOrigen} onChange={(e) => { setCicloOrigen(e.target.value); setOrigen(''); setPromocion(null); }}><option value="">Selecciona…</option>{ciclos.filter((c) => c.estado === 'CERRADO').map((c) => <option key={c.id} value={c.id}>{c.clave}</option>)}</select>
      <label htmlFor="ciclo-destino-promocion">Ciclo en preparación de destino</label><select id="ciclo-destino-promocion" required value={cicloDestino} onChange={(e) => { setCicloDestino(e.target.value); setDestino(''); setPromocion(null); }}><option value="">Selecciona…</option>{ciclos.filter((c) => c.estado === 'PREPARACION').map((c) => <option key={c.id} value={c.id}>{c.clave}</option>)}</select>
      <SelectorBuscable<Grupo> ruta="/academico/grupos" valor={origen} cambiar={(id) => { setOrigen(id); setPromocion(null); }} etiqueta="Grupo de origen" deshabilitado={!cicloOrigen} filtros={{ inactivos: 'true', cicloId: cicloOrigen || undefined }} texto={(g) => `${g.nombre} · ${g.ciclo.clave} · ${g.plantel.nombre}`} />
      <SelectorBuscable<Grupo> ruta="/academico/grupos" valor={destino} cambiar={(id) => { setDestino(id); setPromocion(null); }} etiqueta="Grupo de destino" deshabilitado={!cicloDestino} filtros={{ inactivos: 'true', cicloId: cicloDestino || undefined }} texto={(g) => `${g.nombre} · ${g.ciclo.clave} · ${g.plantel.nombre}`} />
      <button className="boton" disabled={enviando || !origen || !destino} onClick={async () => { void operar(async () => { const { data } = await api.post<PreviewPromocion>('/academico/promocion/preview', { origenGrupoId: Number(origen), destinoGrupoId: Number(destino) }); setPromocion(data); setElegidos([]); }); }}>Previsualizar promoción</button>
      {promocion && <><p>{promocion.plantel}: {promocion.origen.nombre} → {promocion.destino.nombre}</p><p>{promocion.regla}</p><fieldset><legend>Alumnos que se promoverán</legend>{promocion.alumnos.map((a) => <label key={a.id} className="casilla"><input type="checkbox" disabled={!a.elegible || enviando} checked={elegidos.includes(a.id)} onChange={(e) => setElegidos((ids) => e.target.checked ? [...ids, a.id] : ids.filter((id) => id !== a.id))} />{a.matricula} — {a.nombre}{!a.elegible && ' (ya inscrito)'}</label>)}</fieldset><p>Seleccionados: {elegidos.length}</p><button disabled={enviando || !elegidos.length} onClick={async () => { if (!await confirmacion.solicitar(`¿Inscribir a ${elegidos.length} alumnos seleccionados en ${promocion.destino.nombre}?`)) return; void operar(async () => { const { data } = await api.post('/academico/promocion/confirmar', { origenGrupoId: Number(origen), destinoGrupoId: Number(destino), alumnoIds: elegidos, confirmado: true }); trabajo.guardado();setMensaje(`${data.inscritos} alumnos promovidos; el historial y las calificaciones de origen se conservan.`); setPromocion(null); setElegidos([]); }); }}>Confirmar promoción</button></>}
    </section>}{!soloFinanzas && (legado || trabajo.modo==='consulta') && <BitacoraAcademica />}</>;
}
