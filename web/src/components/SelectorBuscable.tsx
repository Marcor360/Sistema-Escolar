import { useEffect, useId, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { Paginador } from './Paginador';

/** Cada selector consulta páginas pequeñas; conserva la elección al buscar otra página. */
export function SelectorBuscable<T extends { id: number }>({ ruta, valor, cambiar, etiqueta, texto, filtros = {}, requerido = true, deshabilitado = false }:
  { ruta: string; valor: string; cambiar: (valor: string) => void; etiqueta: string; texto: (item: T) => string;
    filtros?: Record<string, string | number | undefined>; requerido?: boolean; deshabilitado?: boolean }) {
  const id = useId(); const [buscar, setBuscar] = useState(''); const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<{ datos: T[]; total: number }>({ datos: [], total: 0 });
  const [error, setError] = useState(''); const [cargando, setCargando] = useState(false);
  const seleccion = useRef<{ id: string; texto: string } | null>(null);
  const params = JSON.stringify(filtros);
  useEffect(() => {
    let activa = true;
    const timer = setTimeout(() => {
      setCargando(true); setError('');
      api.get(ruta, { params: { ...JSON.parse(params), buscar, pagina, porPagina: 20 } })
        .then(({ data }) => { if (activa) setResultado(data); })
        .catch((err) => { if (activa) setError(mensajeDeError(err)); })
        .finally(() => { if (activa) setCargando(false); });
    }, 250);
    return () => { activa = false; clearTimeout(timer); };
  }, [ruta, buscar, pagina, params]);
  return <div className="campo"><label htmlFor={`${id}-buscar`}>Buscar {etiqueta.toLowerCase()}</label>
    <input id={`${id}-buscar`} disabled={deshabilitado} value={buscar} placeholder="Nombre o identificador" onChange={(e) => { setBuscar(e.target.value); setPagina(1); }} />
    <label htmlFor={id}>{etiqueta}</label><select id={id} required={requerido} disabled={deshabilitado} value={valor} onChange={(e) => {
      const item = resultado.datos.find((i) => String(i.id) === e.target.value);
      seleccion.current = item ? { id: String(item.id), texto: texto(item) } : null; cambiar(e.target.value);
    }}><option value="">Selecciona…</option>
      {valor && !resultado.datos.some((i) => String(i.id) === valor) && <option value={valor}>{seleccion.current?.id === valor ? seleccion.current.texto : `Seleccionado ${valor}`}</option>}
      {resultado.datos.map((i) => <option key={i.id} value={i.id}>{texto(i)}</option>)}
    </select>{cargando && <span role="status">Buscando…</span>}{error && <span role="alert">{error}</span>}
    <Paginador total={resultado.total} pagina={pagina} porPagina={20} onCambio={setPagina} />
  </div>;
}
