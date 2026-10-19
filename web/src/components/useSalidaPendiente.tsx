import { MutableRefObject, useCallback, useEffect, useRef } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';
import { useConfirmacion } from './useConfirmacion';
export function useSalidaPendiente(sucio: boolean, ocupado: MutableRefObject<boolean>, guardado: MutableRefObject<boolean>, permitirFiltros = false) {
  const confirmacion = useConfirmacion(), solicitar = useRef(confirmacion.solicitar); solicitar.current = confirmacion.solicitar;
  const bloqueo = useBlocker(({currentLocation, nextLocation}) => {
    const actual = new URLSearchParams(currentLocation.search), siguiente = new URLSearchParams(nextLocation.search);
    const mismoFormulario = permitirFiltros && currentLocation.pathname === nextLocation.pathname && actual.get('vista') === siguiente.get('vista') && actual.get('id') === siguiente.get('id');
    return !guardado.current && (ocupado.current || (sucio && !mismoFormulario));
  });
  useBeforeUnload(useCallback((e) => { if (!guardado.current && (sucio || ocupado.current)) { e.preventDefault(); e.returnValue = ''; } }, [sucio, ocupado, guardado]));
  useEffect(() => {
    if (bloqueo.state !== 'blocked') return;
    if (ocupado.current) { bloqueo.reset(); return; }
    let activo = true;
    void solicitar.current('¿Salir sin guardar los cambios?').then((aceptar) => { if (activo) { if (aceptar) bloqueo.proceed(); else bloqueo.reset(); } });
    return () => { activo = false; };
  }, [bloqueo, ocupado]);
  return confirmacion.elemento;
}
