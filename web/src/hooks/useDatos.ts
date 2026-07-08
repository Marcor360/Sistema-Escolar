import { useCallback, useEffect, useState } from 'react';
import { mensajeDeError } from '../api/client';

/** Carga datos de la API con estados de carga/error y función de recarga. */
export function useDatos<T>(carga: () => Promise<T>, inicial: T) {
  const [datos, setDatos] = useState<T>(inicial);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const recargar = useCallback(() => {
    setCargando(true);
    setError('');
    carga()
      .then(setDatos)
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { recargar(); }, [recargar]);

  return { datos, cargando, error, recargar, setDatos };
}
