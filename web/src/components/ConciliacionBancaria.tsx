import { useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useDatos } from '../hooks/useDatos';
import { useConfirmacion } from './useConfirmacion';
import { leerCsvBancario } from '../utils/csv-bancario';
interface Movimiento {
  id: number;
  folio: string;
  referencia: string;
  fecha: string;
  monto: number;
  estado: string;
  cargoId: number | null;
}
export function ConciliacionBancaria() {
  const { datos: planteles } = useDatos<{ id: number; nombre: string }[]>(
    () => api.get('/planteles/mios').then((r) => r.data),
    [],
  );
  const {
    datos: movimientos,
    error: errorCarga,
    recargar,
  } = useDatos<Movimiento[]>(() => api.get('/seguimiento/movimientos').then((r) => r.data), []);
  const [plantel, setPlantel] = useState(''),
    [cuenta, setCuenta] = useState(''),
    [csv, setCsv] = useState(''),
    [preview, setPreview] = useState<
      { folio: string; monto: number; duplicado: boolean; cargoSugerido: { id: number; descripcion: string } | null }[]
    >([]),
    [cargos, setCargos] = useState<Record<number, string>>({});
  const [error, setError] = useState(''),
    [mensaje, setMensaje] = useState(''),
    [ocupado, setOcupado] = useState(false);
  const confirmar = useConfirmacion();
  const datos = () => ({ plantelId: Number(plantel), cuenta, movimientos: leerCsvBancario(csv) });
  const previsualizar = async () => {
    setError('');
    setPreview([]);
    setOcupado(true);
    try {
      setPreview((await api.post('/seguimiento/movimientos/preview', datos())).data);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  const importar = async () => {
    if (!(await confirmar.solicitar('¿Importar estos movimientos? Todavía no se registrará ningún pago.'))) return;
    setOcupado(true);
    try {
      await api.post('/seguimiento/movimientos', datos());
      setPreview([]);
      setMensaje('Movimientos importados; revisa cada aplicación.');
      recargar();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  const aplicar = async (m: Movimiento) => {
    const cargo = Number(m.cargoId ?? cargos[m.id]);
    if (!cargo) {
      setError('Selecciona el cargo del movimiento');
      return;
    }
    if (
      !(await confirmar.solicitar(
        '¿Aplicar ' + m.monto + ' del folio ' + m.folio + ' al cargo ' + cargo + '? Verifica el comprobante bancario.',
      ))
    )
      return;
    setOcupado(true);
    setError('');
    try {
      await api.post('/seguimiento/movimientos/' + m.id + '/aplicar', { cargoId: cargo });
      recargar();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <section className="panel">
      {confirmar.elemento}
      <h2>Importar movimientos bancarios</h2>
      <p>
        Usa un alias estable de la cuenta y el folio único del banco. CSV: folio,referencia,fecha,monto; fechas
        AAAA-MM-DD y montos sin separadores de miles.
      </p>
      {(error || errorCarga) && <p role="alert">{error || errorCarga}</p>}
      {mensaje && <p role="status">{mensaje}</p>}
      <label>
        Plantel
        <select
          value={plantel}
          disabled={ocupado}
          onChange={(e) => {
            setPlantel(e.target.value);
            setPreview([]);
          }}
        >
          <option value="">Selecciona…</option>
          {planteles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </label>
      <label>
        Alias de cuenta
        <input
          value={cuenta}
          maxLength={40}
          disabled={ocupado}
          onChange={(e) => {
            setCuenta(e.target.value);
            setPreview([]);
          }}
        />
      </label>
      <label>
        Archivo CSV
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={ocupado}
          onChange={(e) => {
            const f = e.target.files?.[0];
            setPreview([]);
            if (f) {
              if (f.size > 1024 * 1024) {
                setError('Máximo 1 MiB');
                return;
              }
              void f
                .text()
                .then(setCsv)
                .catch(() => setError('No se pudo leer el archivo'));
            }
          }}
        />
      </label>
      <button disabled={ocupado || !csv || !plantel || !cuenta} onClick={() => void previsualizar()}>
        Previsualizar movimientos
      </button>
      {!!preview.length && (
        <>
          <ul>
            {preview.map((m) => (
              <li key={m.folio}>
                {m.folio} · {m.monto} ·{' '}
                {m.duplicado
                  ? 'Ya importado'
                  : m.cargoSugerido
                    ? 'Cargo sugerido ' + m.cargoSugerido.id + ' · ' + m.cargoSugerido.descripcion
                    : 'Sin coincidencia automática'}
              </li>
            ))}
          </ul>
          <button disabled={ocupado} onClick={() => void importar()}>
            Confirmar importación
          </button>
        </>
      )}
      <h3>Movimientos importados</h3>
      <button onClick={recargar} disabled={ocupado}>
        Actualizar movimientos
      </button>
      {movimientos.map((m) => (
        <div key={m.id}>
          <p>
            {m.fecha} · {m.folio} · {m.referencia} · {m.monto} · {m.estado}
          </p>
          {m.estado !== 'APLICADO' && (
            <>
              <label>
                Cargo a conciliar
                <input
                  type="number"
                  min={1}
                  disabled={ocupado || !!m.cargoId}
                  value={m.cargoId ?? cargos[m.id] ?? ''}
                  onChange={(e) => setCargos((c) => ({ ...c, [m.id]: e.target.value }))}
                />
              </label>
              <button disabled={ocupado} onClick={() => void aplicar(m)}>
                Confirmar aplicación
              </button>
            </>
          )}
        </div>
      ))}
    </section>
  );
}
