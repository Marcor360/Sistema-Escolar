import { useCallback, useEffect, useRef, useState } from 'react';
import { mensajeDeError } from '../api/client';

function invalidarSolicitud(referencia: { current: number }) {
  referencia.current++;
}

/** Carga datos de la API con estados de carga/error y función de recarga. */
export function useDatos<T>(carga: () => Promise<T>, inicial: T) {
  const cargaActual = useRef(carga);
  const solicitud = useRef(0);
  const [datos, setDatos] = useState<T>(inicial);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { cargaActual.current = carga; }, [carga]);

  const recargar = useCallback(() => {
    const idSolicitud = ++solicitud.current;
    setCargando(true);
    setError('');
    cargaActual.current()
      .then((resultado) => { if (solicitud.current === idSolicitud) setDatos(resultado); })
      .catch((err) => { if (solicitud.current === idSolicitud) setError(mensajeDeError(err)); })
      .finally(() => { if (solicitud.current === idSolicitud) setCargando(false); });
  }, []);

  useEffect(() => {
    recargar();
    return () => { invalidarSolicitud(solicitud); };
  }, [recargar]);

  return { datos, cargando, error, recargar, setDatos, setError };
}
