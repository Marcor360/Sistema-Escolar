import { Cargando } from './Cargando';
import { createContext, ReactNode, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { UNSAFE_DataRouterContext, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Encabezado } from './Encabezado';
import { PanelAccionesModulo } from './PanelAccionesModulo';
import { useSalidaPendiente } from './useSalidaPendiente';
interface Accion { titulo: string; detalle: string; vista: string; roles?: string[] }
interface Trabajo { modo: string; id: number | null; query: URLSearchParams; ir: (vista: string, id?: number) => void; guardado: () => void; ocupado: (v: boolean) => void; actualizar: (c: Record<string, string>) => void }
const SIN_QUERY = new URLSearchParams();
const FUERA: Trabajo = { modo: 'legado', id: null, query: SIN_QUERY, ir: () => undefined, guardado: () => undefined, ocupado: () => undefined, actualizar: () => undefined };
const TrabajoContext = createContext<Trabajo>(FUERA);
export function useModuloTrabajo(ocupado = false) {
  const trabajo = useContext(TrabajoContext);
  const actualizarOcupado = trabajo.ocupado;
  useEffect(() => { actualizarOcupado(ocupado); return () => actualizarOcupado(false); }, [ocupado, actualizarOcupado]);
  return trabajo;
}
function Bloqueo({ sucio, ocupado, guardado }: { sucio: boolean; ocupado: React.MutableRefObject<boolean>; guardado: React.MutableRefObject<boolean> }) {
  return useSalidaPendiente(sucio, ocupado, guardado, true);
}
function Guardia({ children }: { children: ReactNode }) {
  return useContext(UNSAFE_DataRouterContext) ? children : null;
}
export const esFormularioModulo = (vista: string) => ['nuevo', 'editar', 'adjuntar', 'actividad-nueva', 'actividad-editar', 'material-nuevo', 'material-editar', 'calificar-entrega', 'ciclo-nuevo', 'ciclo-editar', 'cargo-nuevo', 'pago-nuevo', 'colegiaturas', 'carpeta-nueva', 'archivo-nuevo', 'seguimiento', 'importar', 'promover', 'reinscribir'].includes(vista);

export function ModuloTrabajo({ titulo, acciones, vistas = [], permisos = {}, vistaInicial, children }: { titulo: string; acciones: Accion[]; vistas?: string[]; permisos?: Record<string,string[]>; vistaInicial?: string; children: ReactNode }) {
  const { tieneRol } = useAuth(), [query, setQuery] = useSearchParams();
  const permitidas = acciones.filter(a => !a.roles || tieneRol(...a.roles));
  const solicitada = query.get('vista') || vistaInicial || '';
  const necesitaId = ['editar','ciclo-editar','contextos','detalle','adjuntar','actividad-editar','material-editar','calificar-entrega','administrar','seguimiento'].includes(solicitada);
  const idValido = Number.isSafeInteger(Number(query.get('id'))) && Number(query.get('id')) > 0;
  const autorizada = !permisos[solicitada] || tieneRol(...permisos[solicitada]);
  const modo = autorizada && (!necesitaId || idValido) && (permitidas.some(a => a.vista === solicitada) || vistas.includes(solicitada)) ? solicitada : '';
  const foco = useRef<HTMLHeadingElement>(null), ocupado = useRef(false), guardado = useRef(false);
  const [ocupadoVisible, setOcupadoVisible] = useState(false);
  const [sucio, setSucio] = useState(false);
  const guardadoActual = useCallback(() => { guardado.current = true; setSucio(false); }, []);
  const ocupadoActual = useCallback((valor: boolean) => { ocupado.current = valor; setOcupadoVisible(valor); }, []);
  const ir = useCallback((vista: string, id?: number) => setQuery(prev => {
    const next = new URLSearchParams(prev); if(vista) next.set('vista', vista); else next.delete('vista');
    if (id) next.set('id', String(id)); else next.delete('id'); return next;
  }), [setQuery]);
  const actualizar = useCallback((cambios: Record<string, string>) => setQuery(prev => { const next = new URLSearchParams(prev); for (const [k, v] of Object.entries(cambios)) { if (v) next.set(k, v); else next.delete(k); } return next; }, { replace: true }), [setQuery]);
  const idSolicitado = query.get('id');
  useEffect(() => { guardado.current = false; setSucio(false); foco.current?.focus(); }, [modo, idSolicitado]);
  const id = Number(query.get('id'));
  const valor = useMemo(() => ({ modo, id: Number.isSafeInteger(id) && id > 0 ? id : null, query, ir, guardado: guardadoActual, ocupado: ocupadoActual, actualizar }), [modo, id, query, ir, guardadoActual, ocupadoActual, actualizar]);
  if (!modo) return <><Encabezado titulo={titulo} detalle="Selecciona una operación para comenzar" /><PanelAccionesModulo titulo={`Gestión de ${titulo.toLowerCase()}`} acciones={permitidas.map(a => ({ ...a, ejecutar: () => ir(a.vista) }))} /></>;
  return <TrabajoContext.Provider value={valor}>
    <Guardia><Bloqueo sucio={sucio} ocupado={ocupado} guardado={guardado} /></Guardia>
    <div className={esFormularioModulo(modo) ? 'trabajo-enfocado' : ''} onChangeCapture={() => { if (esFormularioModulo(modo)) { guardado.current = false; setSucio(true); } }}>
      <h2 ref={foco} tabIndex={-1} className="solo-lector">{titulo}: {esFormularioModulo(modo) ? 'Formulario' : 'Consulta'}</h2>
      <button type="button" className="boton secundario" disabled={ocupadoVisible} onClick={() => ir(({ 'actividad-nueva': 'actividades', 'actividad-editar': 'actividades', 'material-nuevo': 'materiales', 'material-editar': 'materiales', 'calificar-entrega': 'entregas', 'cargo-nuevo': 'cargos', 'pago-nuevo': 'pagos', 'colegiaturas': 'cargos', 'ciclo-nuevo': 'ciclos', 'ciclo-editar': 'ciclos' } as Record<string, string>)[modo] || (esFormularioModulo(modo) ? 'consulta' : ''))}>{esFormularioModulo(modo) ? 'Cancelar y volver a consulta' : 'Volver a opciones'}</button>
      <Suspense fallback={<Cargando />}>{children}</Suspense>
    </div>
  </TrabajoContext.Provider>;
}
