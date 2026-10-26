import { useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useConfirmacion } from './useConfirmacion';
export function ImportarCalendario({
  cicloId,
  nivelId,
  plantelId,
  audiencia,
  alGuardar,
}: {
  cicloId: number;
  nivelId: number;
  plantelId: number;
  audiencia: string;
  alGuardar: () => void;
}) {
  const [contenido, setContenido] = useState(''),
    [preview, setPreview] = useState<{ titulo: string; fechaInicio: string; fechaFin: string | null }[]>([]),
    [error, setError] = useState(''),
    [mensaje, setMensaje] = useState(''),
    [ocupado, setOcupado] = useState(false);
  const confirmar = useConfirmacion();
  const datos = { cicloId, nivelId, plantelId, audiencia, contenido };
  const consultar = async () => {
    setOcupado(true);
    setError('');
    try {
      setPreview((await api.post('/calendario/ics/preview', datos)).data);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  const guardar = async () => {
    if (
      !(await confirmar.solicitar(
        '¿Importar ' + preview.length + ' eventos al ciclo, nivel y audiencia seleccionados?',
      ))
    )
      return;
    setOcupado(true);
    try {
      const r = await api.post('/calendario/ics', datos);
      setMensaje(r.data.creados + ' eventos importados; los UID ya importados se conservan.');
      setPreview([]);
      alGuardar();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <details>
      {confirmar.elemento}
      <summary>Importar calendario .ics</summary>
      <p>
        Hasta 100 eventos. Admite fechas completas y UTC. Expande las recurrencias y convierte otras zonas a UTC antes
        de importar.
      </p>
      {error && <p role="alert">{error}</p>}
      {mensaje && <p role="status">{mensaje}</p>}
      <label>
        Archivo de calendario
        <input
          type="file"
          accept=".ics,text/calendar"
          disabled={ocupado}
          onChange={(e) => {
            setPreview([]);
            const f = e.target.files?.[0];
            if (f) {
              if (f.size > 100000) {
                setError('Máximo 100 kB');
                return;
              }
              void f
                .text()
                .then(setContenido)
                .catch(() => setError('No se pudo leer el archivo'));
            }
          }}
        />
      </label>
      <button disabled={ocupado || !contenido || !nivelId} onClick={() => void consultar()}>
        Previsualizar eventos del archivo
      </button>
      {!!preview.length && (
        <>
          <ul>
            {preview.map((p, i) => (
              <li key={i}>
                {p.fechaInicio} · {p.titulo}
              </li>
            ))}
          </ul>
          <button disabled={ocupado} onClick={() => void guardar()}>
            Confirmar eventos del archivo
          </button>
        </>
      )}
    </details>
  );
}
