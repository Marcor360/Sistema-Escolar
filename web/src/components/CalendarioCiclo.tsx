import { ImportarCalendario } from './ImportarCalendario';
import { useConfirmacion } from './useConfirmacion';
import { exportarIcs } from '../utils/calendario-ics';
import { FormEvent, useEffect, useState, useRef } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import './calendario-ciclo.css';
interface Ciclo {
  id: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
}
interface Nivel {
  id: number;
  nombre: string;
  plantelId: number;
  plantel?: { nombre: string };
}
interface Evento {
  revision: string;
  tipo: string;
  nivelId: number | null;
  cicloId: number | null;
  id: number;
  titulo: string;
  fechaInicio: string;
  fechaFin: string | null;
  imagenNombre: string | null;
  audiencia: string;
}
const dia = (v: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(v));
async function cargarEventosCiclo(ciclo: Ciclo, nivelId: string) {
  const eventos = new Map<number, Evento>();
  const fin = new Date(ciclo.fechaFin + 'T23:59:59-06:00').getTime();
  let inicio = new Date(ciclo.fechaInicio + 'T00:00:00-06:00').getTime();
  while (inicio <= fin) {
    const hasta = Math.min(fin, inicio + 365 * 86400000);
    const { data } = await api.get<Evento[]>('/calendario', {
      params: {
        cicloId: ciclo.id,
        nivelId: nivelId || undefined,
        desde: new Date(inicio).toISOString(),
        hasta: new Date(hasta).toISOString(),
      },
    });
    data.forEach((e) => eventos.set(e.id, e));
    inicio = hasta + 1;
  }
  return [...eventos.values()];
}
function ImagenCalendario({ evento }: { evento: Evento }) {
  const [url, setUrl] = useState('');
  const [cargandoImagen,setCargandoImagen]=useState(true),[errorImagen,setErrorImagen]=useState(''),[intento,setIntento]=useState(0);
  useEffect(() => {
    setUrl('');setCargandoImagen(true);setErrorImagen('');
    let activa = true,
      objeto = '';
    api
      .get<{ url: string }>('/archivos/calendario/' + evento.id + '/enlace')
      .then(({ data }) => api.get(data.url.replace(/^\/api/, ''), { responseType: 'blob' }))
      .then((r) => {
        if (activa) {
          objeto = URL.createObjectURL(r.data);
          setUrl(objeto);
        }
      })
      .catch(()=>{if(activa)setErrorImagen('No se pudo cargar la imagen.');}).finally(()=>{if(activa)setCargandoImagen(false);});
    return () => {
      activa = false;
      if (objeto) URL.revokeObjectURL(objeto);
    };
  }, [evento.id,evento.imagenNombre,intento]);
  return (
    <figure>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img onError={()=>{setUrl('');setErrorImagen('No se pudo interpretar la imagen. Vuelve a intentarlo.');}} src={url} alt={evento.titulo} style={{ maxWidth: '100%', maxHeight: 900 }} />
        </a>
      ) : (
        <p role={errorImagen?'alert':'status'}>{cargandoImagen?'Cargando imagen…':errorImagen||'Imagen no disponible.'}</p>
      )}
      {!cargandoImagen&&!!errorImagen&&<button type="button" onClick={()=>setIntento(i=>i+1)}>Reintentar imagen</button>}
      <figcaption>{evento.titulo}</figcaption>
    </figure>
  );
}
export function CalendarioCiclo() {
  const { sesion } = useAuth();
  const confirmar = useConfirmacion();
  const [editando, setEditando] = useState<Evento | null>(null);
  const [cargando, setCargando] = useState(false);
  const [cargandoOpciones, setCargandoOpciones] = useState(true);
  const [opcionesRevision, setOpcionesRevision] = useState(0);
  const formulario = useRef<HTMLDetailsElement>(null);
  const entradaArchivo = useRef<HTMLInputElement>(null);
  const gestionar = !!sesion?.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO', 'FINANZAS'].includes(r));
  const [opciones, setOpciones] = useState<{ ciclos: Ciclo[]; niveles: Nivel[] }>({ ciclos: [], niveles: [] });
  const [cicloId, setCicloId] = useState(''),
    [nivelId, setNivelId] = useState(''),
    [vista, setVista] = useState('ciclo'),
    [mes, setMes] = useState('');
  const [eventos, setEventos] = useState<Evento[]>([]),
    [error, setError] = useState(''),
    [ocupado, setOcupado] = useState(false);
  const [titulo, setTitulo] = useState(''),
    [fecha, setFecha] = useState(''),
    [audiencia, setAudiencia] = useState('ACADEMICA'),
    [tipo, setTipo] = useState('GENERAL'),
    [archivo, setArchivo] = useState<File | null>(null);
  const [revision, setRevision] = useState(0);
  const [avisar, setAvisar] = useState(false);
  const [historial, setHistorial] = useState<
    { id: number; usuarioId: number; autor?:string; accion: string; alcance: string; createdAt: string }[]
  >([]);
  useEffect(() => {
    let activo = true;
    setCargandoOpciones(true);
    api
      .get('/calendario/opciones')
      .then(({ data }) => {
        if (activo && Array.isArray(data?.ciclos)) {
          setOpciones(data);
          setCicloId(
            String(data.ciclos.find((c: Ciclo & { activo: boolean }) => c.activo)?.id ?? data.ciclos[0]?.id ?? ''),
          );
        }
      })
      .catch((e) => {
        if (activo) {
          setError(mensajeDeError(e));
          setCargando(false);
        }
      }).finally(() => {if(activo)setCargandoOpciones(false);});
    return () => {
      activo = false;
    };
  }, [opcionesRevision]);
  useEffect(() => {
    const recargar = () => setRevision((r) => r + 1);
    window.addEventListener('calendario-cambio', recargar);
    return () => window.removeEventListener('calendario-cambio', recargar);
  }, []);
  const ciclo = opciones.ciclos.find((c) => String(c.id) === cicloId);
  useEffect(() => {
    if (!ciclo) return;
    setMes((prev) =>
      prev >= ciclo.fechaInicio.slice(0, 7) && prev <= ciclo.fechaFin.slice(0, 7)
        ? prev
        : ciclo.fechaInicio.slice(0, 7),
    );
    let activo = true;
    setError('');
    setEventos([]);
    setCargando(true);
    cargarEventosCiclo(ciclo, nivelId)
      .then((data) => {
        if (activo) {
          setEventos(data);
          setCargando(false);
        }
      })
      .catch((e) => {
        if (activo) {
          setError(mensajeDeError(e));
          setCargando(false);
        }
      });
    return () => {
      activo = false;
    };
  }, [ciclo, nivelId, revision]);
  if (!opciones.ciclos.length)
    return (
      <section>
        <p role={error ? 'alert' : 'status'}>{error || (cargandoOpciones ? 'Consultando ciclos escolares…' : 'No hay ciclos escolares disponibles.')}</p>
        <button onClick={() => setOpcionesRevision((r) => r + 1)}>Reintentar calendario</button>
      </section>
    );
  const meses: string[] = [];
  if (ciclo) {
    let d = new Date(ciclo.fechaInicio.slice(0, 7) + '-01T12:00:00Z');
    while (d.toISOString().slice(0, 7) <= ciclo.fechaFin.slice(0, 7)) {
      meses.push(d.toISOString().slice(0, 7));
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 12));
    }
  }
  const describirAlcance=(valor:string)=>{try{const a=JSON.parse(valor) as {nivelId?:number;plantelId?:number;cicloId?:number;audiencia?:string;grupoId?:number};const n=opciones.niveles.find(n=>n.id===a.nivelId),c=opciones.ciclos.find(c=>c.id===a.cicloId);return [c?.nombre??'Sin ciclo específico',n?.nombre??'Todos los niveles',n?.plantel?.nombre??(a.plantelId?'Plantel '+a.plantelId:'Todos los planteles'),a.audiencia==='ACADEMICA'?'Alumnos y docentes':a.audiencia==='FINANCIERA'?'Personal · fechas financieras':'Solo personal',...(a.grupoId?['Grupo específico']:[])].join(' · ');}catch{return 'Alcance histórico no disponible';}};
  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (ocupado || !ciclo) return;
    const nivel = opciones.niveles.find((n) => String(n.id) === nivelId);
    if (!nivel) {
      setError('Selecciona el nivel de destino para publicar.');
      return;
    }
    setOcupado(true);
    setError('');
    const datos = {
      titulo,
      cicloId: ciclo.id,
      nivelId: nivel.id,
      plantelId: nivel.plantelId,
      audiencia,
      avisar,
      tipo,
      fechaInicio:
        archivo || editando?.imagenNombre ? ciclo.fechaInicio + 'T00:00:00-06:00' : fecha + 'T00:00:00-06:00',
      fechaFin: archivo || editando?.imagenNombre ? ciclo.fechaFin + 'T23:59:59-06:00' : undefined,
    };
    try {
      if (editando) {
        const { data: actualizado } = await api.patch<Evento>('/calendario/' + editando.id, {
          ...datos,
          revision: editando.revision,
        });
        setEditando(actualizado);
        if (archivo) {
          const form = new FormData();
          form.append('revision', actualizado.revision);
          form.append('imagen', archivo);
          await api.post('/calendario/' + editando.id + '/imagen', form);
        }
      } else if (archivo) {
        const form = new FormData();
        Object.entries(datos).forEach(([k, v]) => {
          if (v !== undefined) form.append(k, String(v));
        });
        form.append('imagen', archivo);
        await api.post('/calendario/imagen', form);
      } else await api.post('/calendario', datos);
      window.dispatchEvent(new Event('calendario-cambio'));
      setEditando(null);
      setTitulo('');
      setArchivo(null);
      if (entradaArchivo.current) entradaArchivo.current.value = '';
      setRevision((x) => x + 1);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <section className="panel" aria-label="Calendario del ciclo escolar">
      {confirmar.elemento}
      <h2>Calendario del ciclo escolar</h2>
      <div className="fila">
        <label>
          Ciclo escolar
          <select value={cicloId} onChange={(e) => setCicloId(e.target.value)}>
            {opciones.ciclos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nivel académico
          <select value={nivelId} onChange={(e) => setNivelId(e.target.value)}>
            <option value="">Todos los niveles autorizados</option>
            {opciones.niveles.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nombre} · {n.plantel?.nombre ?? 'Plantel ' + n.plantelId}
              </option>
            ))}
          </select>
        </label>
        <label>
          Vista
          <select value={vista} onChange={(e) => setVista(e.target.value)}>
            <option value="ciclo">Ciclo completo</option>
            <option value="mes">Mes</option>
            <option value="imagen">Imagen institucional</option>
            <option value="agenda">Agenda accesible</option>
          </select>
        </label>
        {vista === 'mes' && (
          <label>
            Mes
            <select value={mes} onChange={(e) => setMes(e.target.value)}>
              {meses.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {cargando && <p role="status">Cargando calendario…</p>}
      <button type="button" disabled={cargando || ocupado} onClick={() => setRevision((r) => r + 1)}>
        Actualizar calendario / reintentar
      </button>
      <button type="button" disabled={cargando || !eventos.length} onClick={() => exportarIcs(eventos)}>
        Exportar calendario (.ics)
      </button>
      {gestionar && (
        <label>
          Evento para gestionar
          <select
            disabled={ocupado}
            value={editando?.id ?? ''}
            onChange={(e) => {
              const evento = eventos.find((v) => v.id === Number(e.target.value));
              setEditando(evento ?? null); setHistorial([]);
              if (evento) {
                setTitulo(evento.titulo);
                setFecha(dia(evento.fechaInicio));
                setAudiencia(evento.audiencia);
                setTipo(evento.tipo);
                if (evento.nivelId) setNivelId(String(evento.nivelId));
                if (formulario.current) formulario.current.open = true;
              }
            }}
          >
            <option value="">Publicar uno nuevo</option>
            {eventos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.titulo} · {e.audiencia}
              </option>
            ))}
          </select>
        </label>
      )}
      {editando && (
        <>
          <p>Editando: {editando.titulo}. El cambio se comprobará contra su revisión actual.</p>
          <button
            type="button"
            disabled={ocupado}
            onClick={async () => {
              if (!(await confirmar.solicitar('¿Eliminar "' + editando.titulo + '" y su imagen, si existe?'))) return;
              setOcupado(true);
              try {
                await api.delete('/calendario/' + editando.id);
                setEditando(null);
                setTitulo('');
                setRevision((r) => r + 1);
                window.dispatchEvent(new Event('calendario-cambio'));
              } catch (e) {
                setError(mensajeDeError(e));
              } finally {
                setOcupado(false);
              }
            }}
          >
            Eliminar evento seleccionado
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => {
              setEditando(null);
              setTitulo('');
              setArchivo(null);
              if (entradaArchivo.current) entradaArchivo.current.value = '';
            }}
          >
            Cancelar edición
          </button>
        </>
      )}

      {gestionar && ciclo && (
        <ImportarCalendario
          key={cicloId + ':' + nivelId + ':' + audiencia}
          cicloId={ciclo.id}
          nivelId={Number(nivelId)}
          plantelId={opciones.niveles.find((n) => String(n.id) === nivelId)?.plantelId ?? 0}
          audiencia={audiencia}
          alGuardar={() => window.dispatchEvent(new Event('calendario-cambio'))}
        />
      )}
      {editando && (
        <>
          <button
            type="button"
            onClick={() => {
              void api
                .get('/calendario/' + editando.id + '/historial')
                .then((r) => setHistorial(r.data))
                .catch((e) => setError(mensajeDeError(e)));
            }}
          >
            Consultar historial de publicación
          </button>
          <ul>
            {historial.map((h) => (
              <li key={h.id}>
                {new Date(h.createdAt).toLocaleString('es-MX')} · {({CREAR:'Publicado',EDITAR:'Editado',ELIMINAR:'Eliminado',CREAR_IMAGEN:'Imagen publicada',REEMPLAZAR_IMAGEN:'Imagen reemplazada',IMPORTAR_ICS:'Importado de calendario'} as Record<string,string>)[h.accion]??h.accion} · {h.autor??'Usuario '+h.usuarioId} · {describirAlcance(h.alcance)}
              </li>
            ))}
          </ul>
        </>
      )}
      {gestionar && (
        <details ref={formulario}>
          <summary>Publicar evento o imagen del ciclo</summary>
          <form onSubmit={guardar} className="fila">
            <p>
              Destino: {opciones.niveles.find((n) => String(n.id) === nivelId)?.nombre ?? 'Selecciona un nivel'} ·
              Plantel {opciones.niveles.find((n) => String(n.id) === nivelId)?.plantelId ?? '—'} · {audiencia} ·{' '}
              {ciclo?.nombre}
            </p>
            <label>
              Título del calendario o evento
              <input required maxLength={150} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </label>
            <label>
              Visibilidad
              <select value={audiencia} onChange={(e) => setAudiencia(e.target.value)}>
                <option value="ACADEMICA">Alumnos y docentes del nivel</option>
                <option value="ADMINISTRATIVA">Solo personal administrativo y financiero</option>
                <option value="FINANCIERA">Cortes y fechas financieras (personal)</option>
              </select>
            </label>
            <label>
              Tipo de fecha
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {['GENERAL', 'EXAMEN', 'ENTREGA', 'FESTIVO', 'PAGO', 'JUNTA'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Imagen opcional del ciclo (PNG, JPG o WebP, máximo 10 MiB)
              <input
                ref={entradaArchivo}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              />
            </label>
            {!archivo && (
              <label>
                Fecha
                <input
                  type="date"
                  required
                  min={ciclo?.fechaInicio}
                  max={ciclo?.fechaFin}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </label>
            )}
            <label>
              <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} />
              Avisar a los alumnos del ámbito académico al guardar
            </label>
            <button disabled={ocupado}>
              {ocupado
                ? 'Guardando…'
                : editando
                  ? 'Guardar cambios del evento'
                  : archivo
                    ? 'Publicar imagen del ciclo'
                    : 'Agregar fecha al calendario digital'}
            </button>
          </form>
        </details>
      )}
      {vista === 'imagen' ? (
        <>
          {eventos
            .filter((e) => e.imagenNombre)
            .map((e) => (
              <ImagenCalendario key={e.id} evento={e} />
            ))}
          {!eventos.some((e) => e.imagenNombre) && <p>No hay imagen publicada para este ámbito.</p>}
        </>
      ) : vista === 'agenda' ? (
        <ul aria-label="Agenda del ciclo">
          {eventos
            .filter((e) => !e.imagenNombre)
            .map((e) => (
              <li key={e.id}>
                {dia(e.fechaInicio)}
                {e.fechaFin ? ' — ' + dia(e.fechaFin) : ''}: {e.titulo}
              </li>
            ))}
        </ul>
      ) : (
        <div className="calendario-meses">
          {(vista === 'mes' ? [mes] : meses).filter(Boolean).map((m) => {
            const [anio, numero] = m.split('-').map(Number);
            const dias = new Date(Date.UTC(anio, numero, 0)).getUTCDate();
            const inicio = (new Date(Date.UTC(anio, numero - 1, 1)).getUTCDay() + 6) % 7;
            return (
              <section className="calendario-mes" key={m}>
                <h3>
                  {new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
                    new Date(m + '-01T12:00:00Z'),
                  )}
                </h3>
                <div className="calendario-dias">
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => (
                    <span aria-hidden="true" key={'d' + i}>
                      {d}
                    </span>
                  ))}
                  {Array.from({ length: inicio }, (_, i) => (
                    <span key={'b' + i} />
                  ))}
                  {Array.from({ length: dias }, (_, i) => {
                    const fechaDia = m + '-' + String(i + 1).padStart(2, '0');
                    const delDia = eventos.filter(
                      (e) =>
                        !e.imagenNombre &&
                        dia(e.fechaInicio) <= fechaDia &&
                        dia(e.fechaFin ?? e.fechaInicio) >= fechaDia,
                    );
                    return (
                      <div key={fechaDia}>
                        <button
                          type="button"
                          aria-label={'Seleccionar ' + fechaDia}
                          disabled={
                            !gestionar || (!!ciclo && (fechaDia < ciclo.fechaInicio || fechaDia > ciclo.fechaFin))
                          }
                          onClick={() => {
                            setFecha(fechaDia);
                            if (formulario.current) formulario.current.open = true;
                          }}
                        >
                          {i + 1}
                        </button>
                        {delDia.map((e) => (
                          <p key={e.id} title={e.titulo}>
                            {e.titulo}
                          </p>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
