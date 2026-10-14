import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, archivosBase, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';
import { Paginador } from '../components/Paginador';
import { useConfirmacion } from '../components/useConfirmacion';
import '../components/tabla-adaptable.css';
interface Plantel {
  id: number;
  nombre: string;
}
interface Carpeta {
  id: number;
  nombre: string;
  padreId: number | null;
}
interface Archivo {
  id: number;
  titulo: string;
  archivoNombre: string;
  categoria: string;
  bytes: number;
  creadoAt: string;
}
interface Listado {
  carpetas: Carpeta[];
  archivos: Archivo[];
  bytes: number;
  cuota: number;
  total: number;
  pagina: number;
  porPagina: number;
}
const VACIO: Listado = { carpetas: [], archivos: [], bytes: 0, cuota: 0, total: 0, pagina: 1, porPagina: 20 };
function invalidar(ref: { current: number }) {
  ref.current++;
}
export default function BibliotecaPage() {
  const [planteles, setPlanteles] = useState<Plantel[]>([]),
    [plantel, setPlantel] = useState(''),
    [carpeta, setCarpeta] = useState(''),
    [datos, setDatos] = useState(VACIO),
    [nombre, setNombre] = useState(''),
    [titulo, setTitulo] = useState(''),
    [categoria, setCategoria] = useState('DOCUMENTO'),
    [error, setError] = useState(''),
    [mensaje, setMensaje] = useState(''),
    [ocupado, setOcupado] = useState(false),
    [cargando, setCargando] = useState(false);
  const consulta = useRef(0),
    file = useRef<HTMLInputElement>(null),
    confirmacion = useConfirmacion();
  useEffect(() => {
    let vivo = true;
    api
      .get<Plantel[]>('/planteles/mios')
      .then((r) => {
        if (vivo) setPlanteles(r.data);
      })
      .catch((e) => {
        if (vivo) setError(mensajeDeError(e));
      });
    return () => {
      vivo = false;
      invalidar(consulta);
    };
  }, []);
  const cargar = useCallback(
    async (pagina = 1) => {
      const actual = ++consulta.current;
      setDatos(VACIO);
      if (!plantel) {
        setCargando(false);
        return;
      }
      setCargando(true);
      setError('');
      try {
        const { data } = await api.get<Listado>('/biblioteca', {
          params: { plantelId: plantel, ...(carpeta ? { carpetaId: carpeta } : {}), pagina },
        });
        if (actual === consulta.current) setDatos(data);
      } catch (e) {
        if (actual === consulta.current) setError(mensajeDeError(e));
      } finally {
        if (actual === consulta.current) setCargando(false);
      }
    },
    [plantel, carpeta],
  );
  useEffect(() => {
    void cargar();
    return () => {
      invalidar(consulta);
    };
  }, [cargar]);
  const crear = async (e: FormEvent) => {
    e.preventDefault();
    if (!plantel || ocupado) return;
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      await api.post('/biblioteca/carpetas', {
        plantelId: Number(plantel),
        nombre,
        ...(carpeta ? { padreId: Number(carpeta) } : {}),
      });
      setNombre('');
      setMensaje('Carpeta creada; selecciónala para cargar archivos.');
      await cargar();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  const subir = async (e: FormEvent) => {
    e.preventDefault();
    const f = file.current?.files?.[0];
    if (!f || !carpeta || ocupado) return;
    if (f.size > 10 * 1024 * 1024) {
      setError('Máximo 10 MB por archivo');
      return;
    }
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      const body = new FormData();
      body.append('archivo', f);
      body.append('carpetaId', carpeta);
      body.append('titulo', titulo);
      body.append('categoria', categoria);
      await api.post('/biblioteca/archivos', body, { timeout: 60000 });
      setTitulo('');
      if (file.current) file.current.value = '';
      setMensaje('Archivo validado y guardado de forma privada.');
      await cargar();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  const descargar = async (id: number) => {
    setOcupado(true);
    setError('');
    try {
      const { data } = await api.get<{ url: string }>(`/archivos/biblioteca/${id}/enlace`);
      window.open(`${archivosBase}${data.url}`, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  const eliminar = async (a: Archivo) => {
    if (!(await confirmacion.solicitar(`¿Eliminar ${a.titulo}? Se revocará su descarga.`))) return;
    setOcupado(true);
    setError('');
    try {
      await api.delete(`/biblioteca/archivos/${a.id}`);
      setMensaje('Archivo eliminado.');
      await cargar();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <>
      {confirmacion.elemento}
      <Encabezado
        titulo="Biblioteca institucional"
        detalle="Carpetas y archivos privados por plantel, disponibles al personal administrativo autorizado"
      />
      {error && (
        <p role="alert" className="mensaje-error">
          {error}
        </p>
      )}
      {mensaje && <p role="status">{mensaje}</p>}
      <section className="panel">
        <div className="fila">
          <div className="campo">
            <label htmlFor="bib-plantel">Plantel</label>
            <select
              id="bib-plantel"
              disabled={ocupado}
              value={plantel}
              onChange={(e) => {
                consulta.current++;
                setPlantel(e.target.value);
                setCarpeta('');
                setMensaje('');
              }}
            >
              <option value="">Selecciona un plantel</option>
              {planteles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="bib-carpeta">Carpeta</label>
            <select id="bib-carpeta" disabled={ocupado} value={carpeta} onChange={(e) => setCarpeta(e.target.value)}>
              <option value="">Todas / raíz</option>
              {datos.carpetas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.padreId ? `${datos.carpetas.find((p) => p.id === c.padreId)?.nombre ?? 'Carpeta'} / ` : ''}
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
        {plantel && (
          <p>
            Espacio utilizado: {(datos.bytes / 1048576).toFixed(1)} de {(datos.cuota / 1048576).toFixed(1)} MB.
          </p>
        )}
      </section>
      {plantel && (
        <section className="panel">
          <h2>Crear carpeta</h2>
          <form onSubmit={crear} className="fila">
            <div className="campo">
              <label htmlFor="bib-nombre">Nombre de carpeta{carpeta ? ' dentro de la seleccionada' : ''}</label>
              <input
                id="bib-nombre"
                required
                maxLength={120}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <button className="boton" disabled={ocupado}>
              Crear carpeta
            </button>
          </form>
          <h2>Subir archivo</h2>
          <p>
            PNG/JPEG para fotos y logos; también PDF para calendarios y documentos. Máximo 10 MB. Se requiere antivirus
            operativo; el archivo permanece privado y no cambia la identidad visual pública.
          </p>
          <form onSubmit={subir}>
            <fieldset disabled={ocupado || !carpeta} className="grupo-formulario" style={{ border: 0 }}>
              <legend>
                {carpeta ? 'Archivo para la carpeta seleccionada' : 'Selecciona una carpeta antes de cargar'}
              </legend>
              <div className="campo">
                <label htmlFor="bib-titulo">Título</label>
                <input
                  id="bib-titulo"
                  required
                  maxLength={150}
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                />
              </div>
              <div className="campo">
                <label htmlFor="bib-categoria">Categoría</label>
                <select id="bib-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                  {['DOCUMENTO', 'FOTO', 'LOGO', 'CALENDARIO'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="bib-archivo">Archivo</label>
                <input id="bib-archivo" type="file" ref={file} required accept=".pdf,.png,.jpg,.jpeg" />
              </div>
              <button className="boton">Validar y subir</button>
            </fieldset>
          </form>
        </section>
      )}
      {(ocupado || cargando) && <p role="status">Procesando…</p>}
      {plantel && (
        <>
          <div className="tabla-contenedor" role="region" aria-label="Archivos de biblioteca" tabIndex={0}>
            <table className="tabla tabla-adaptable">
              <thead>
                <tr>
                  <th scope="col">Título</th>
                  <th scope="col">Categoría</th>
                  <th scope="col">Tamaño</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {datos.archivos.map((a) => (
                  <tr key={a.id}>
                    <td data-etiqueta="Título">
                      {a.titulo}
                      <small> {a.archivoNombre}</small>
                    </td>
                    <td data-etiqueta="Categoría">{a.categoria}</td>
                    <td data-etiqueta="Tamaño">{(a.bytes / 1024).toFixed(0)} KB</td>
                    <td data-etiqueta="Acciones">
                      <button disabled={ocupado} onClick={() => descargar(a.id)}>
                        Descargar
                      </button>
                      <button disabled={ocupado} onClick={() => eliminar(a)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {!cargando && !datos.archivos.length && (
                  <tr>
                    <td colSpan={4}>No hay archivos en esta selección.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Paginador
            total={datos.total}
            pagina={datos.pagina}
            porPagina={datos.porPagina}
            deshabilitado={ocupado || cargando}
            onCambio={cargar}
          />
        </>
      )}
    </>
  );
}
