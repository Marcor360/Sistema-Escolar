import { useEffect, useId, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { Paginador } from './Paginador';

/** Cada selector consulta páginas pequeñas; conserva la elección al buscar otra página. */
export function SelectorBuscable<T extends { id: number }>({
  ruta,
  valor,
  cambiar,
  etiqueta,
  texto,
  filtros = {},
  requerido = true,
  deshabilitado = false,
  alSeleccionar,
  confirmarCambio,
}: {
  ruta: string;
  valor: string;
  cambiar: (valor: string) => void;
  etiqueta: string;
  texto: (item: T) => string;
  filtros?: Record<string, string | number | undefined>;
  requerido?: boolean;
  deshabilitado?: boolean;
  alSeleccionar?: (item: T | undefined) => void;
  confirmarCambio?: () => Promise<boolean>;
}) {
  const id = useId();
  const [buscar, setBuscar] = useState('');
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<{ datos: T[]; total: number }>({ datos: [], total: 0 });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [reintento, setReintento] = useState(0);
  const seleccion = useRef<{ id: string; texto: string } | null>(null);
  const params = JSON.stringify(filtros);
  useEffect(() => {
    setPagina(1);
  }, [ruta, params]);
  useEffect(() => {
    let activa = true;
    const controller = new AbortController();
    setCargando(true);
    setError('');
    const timer = setTimeout(() => {
      setCargando(true);
      setError('');
      api
        .get(ruta, { signal: controller.signal, params: { ...JSON.parse(params), buscar, pagina, porPagina: 10 } })
        .then(({ data }) => {
          if (activa) setResultado(data);
        })
        .catch((err) => {
          if (activa) setError(mensajeDeError(err));
        })
        .finally(() => {
          if (activa) setCargando(false);
        });
    }, 250);
    return () => {
      activa = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [ruta, buscar, pagina, params, reintento]);
  return (
    <div className="campo selector-buscable">
      <label htmlFor={`${id}-buscar`}>Buscar {etiqueta.toLowerCase()}</label>
      <input
        id={`${id}-buscar`}
        type="search"
        aria-describedby={`${id}-ayuda`}
        disabled={deshabilitado}
        value={buscar}
        placeholder="Nombre o identificador"
        onChange={(e) => {
          setBuscar(e.target.value);
          setPagina(1);
        }}
      />
      <p className="texto-ayuda" id={`${id}-ayuda`}>
        Busca por nombre o identificador y selecciona un resultado.
      </p>
      <label htmlFor={id}>{etiqueta}</label>
      <select
        id={id}
        required={requerido}
        disabled={deshabilitado || cargando}
        aria-busy={cargando}
        value={valor}
        onChange={(e) => {
          const item = resultado.datos.find((i) => String(i.id) === e.target.value);
          const valorNuevo = e.target.value;
          const aplicar = () => {
            seleccion.current = item ? { id: String(item.id), texto: texto(item) } : null;
            cambiar(valorNuevo);
            alSeleccionar?.(item);
          };
          if (confirmarCambio)
            void confirmarCambio()
              .then((aceptar) => {
                if (aceptar) aplicar();
              })
              .catch((err) => setError(mensajeDeError(err)));
          else aplicar();
        }}
      >
        <option value="">Selecciona…</option>
        {valor && !resultado.datos.some((i) => String(i.id) === valor) && (
          <option value={valor}>
            {seleccion.current?.id === valor ? seleccion.current.texto : `Seleccionado ${valor}`}
          </option>
        )}
        {resultado.datos.map((i) => (
          <option key={i.id} value={i.id}>
            {texto(i)}
          </option>
        ))}
      </select>
      {cargando && <span role="status">Buscando…</span>}
      {error && (
        <div role="alert" className="selector-error">
          <span>{error}</span>
          <button
            type="button"
            className="boton secundario"
            disabled={deshabilitado || cargando}
            onClick={() => setReintento((n) => n + 1)}
          >
            Reintentar búsqueda
          </button>
        </div>
      )}
      {resultado.total > 10 ? (
        <Paginador
          etiqueta={`Paginación de ${etiqueta.toLowerCase()}`}
          total={resultado.total}
          pagina={pagina}
          porPagina={10}
          onCambio={setPagina}
          deshabilitado={deshabilitado || cargando}
        />
      ) : (
        !cargando &&
        !error && (
          <p className="selector-resultados" role="status">
            {resultado.total === 0
              ? 'No hay resultados para esta búsqueda.'
              : `${resultado.total} ${resultado.total === 1 ? 'resultado disponible' : 'resultados disponibles'}`}
          </p>
        )
      )}
    </div>
  );
}
