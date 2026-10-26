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
}
interface Evento {
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
  useEffect(() => {
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
      .catch(() => undefined);
    return () => {
      activa = false;
      if (objeto) URL.revokeObjectURL(objeto);
    };
  }, [evento.id]);
  return (
    <figure>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={evento.titulo} style={{ maxWidth: '100%', maxHeight: 900 }} />
        </a>
      ) : (
        <p>Imagen no disponible; vuelve a consultar.</p>
      )}
      <figcaption>{evento.titulo}</figcaption>
    </figure>
  );
}
export function CalendarioCiclo() {
  const { sesion } = useAuth();
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
  useEffect(() => {
    let activo = true;
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
        if (activo) setError(mensajeDeError(e));
      });
    return () => {
      activo = false;
    };
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
    cargarEventosCiclo(ciclo, nivelId)
      .then((data) => {
        if (activo) setEventos(data);
      })
      .catch((e) => {
        if (activo) setError(mensajeDeError(e));
      });
    return () => {
      activo = false;
    };
  }, [ciclo, nivelId, revision]);
  if (!opciones.ciclos.length) return error ? <p role="alert">{error}</p> : null;
  const meses: string[] = [];
  if (ciclo) {
    let d = new Date(ciclo.fechaInicio.slice(0, 7) + '-01T12:00:00Z');
    while (d.toISOString().slice(0, 7) <= ciclo.fechaFin.slice(0, 7)) {
      meses.push(d.toISOString().slice(0, 7));
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 12));
    }
  }
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
      tipo,
      fechaInicio: archivo ? ciclo.fechaInicio + 'T00:00:00-06:00' : fecha + 'T00:00:00-06:00',
      fechaFin: archivo ? ciclo.fechaFin + 'T23:59:59-06:00' : undefined,
    };
    try {
      if (archivo) {
        const form = new FormData();
        Object.entries(datos).forEach(([k, v]) => {
          if (v !== undefined) form.append(k, String(v));
        });
        form.append('imagen', archivo);
        await api.post('/calendario/imagen', form);
      } else await api.post('/calendario', datos);
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
                {n.nombre}
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
      {gestionar && (
        <details ref={formulario}>
          <summary>Publicar evento o imagen del ciclo</summary>
          <form onSubmit={guardar} className="fila">
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
            <button disabled={ocupado}>
              {ocupado ? 'Guardando…' : archivo ? 'Publicar imagen del ciclo' : 'Agregar fecha al calendario digital'}
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
                          disabled={!gestionar}
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
