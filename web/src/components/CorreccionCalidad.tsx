import { useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useConfirmacion } from './useConfirmacion';
interface Preview {
  matricula: string;
  revision: string;
  antes: { telefono: string | null; curp: string | null };
  despues: { telefono: string | null; curp: string | null };
}
export function CorreccionCalidad({
  alumnos,
  alGuardar,
}: {
  alumnos: { id: number; matricula: string }[];
  alGuardar: () => void;
}) {
  const [alumnoId, setAlumnoId] = useState(''),
    [telefono, setTelefono] = useState(''),
    [curp, setCurp] = useState(''),
    [preview, setPreview] = useState<Preview | null>(null),
    [error, setError] = useState(''),
    [mensaje, setMensaje] = useState(''),
    [ocupado, setOcupado] = useState(false);
  const confirmar = useConfirmacion();
  const datos = {
    alumnoId: Number(alumnoId),
    ...(telefono.trim() ? { telefono: telefono.trim() } : {}),
    ...(curp.trim() ? { curp: curp.trim().toUpperCase() } : {}),
  };
  const consultar = async () => {
    setOcupado(true);
    setError('');
    setPreview(null);
    try {
      setPreview((await api.post('/seguimiento/calidad/preview', datos)).data);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  const guardar = async () => {
    if (
      !preview ||
      !(await confirmar.solicitar('¿Confirmar únicamente los cambios previsualizados de ' + preview.matricula + '?'))
    )
      return;
    setOcupado(true);
    try {
      await api.post('/seguimiento/calidad/confirmar', { ...datos, revision: preview.revision });
      setPreview(null);
      setMensaje('Corrección guardada');
      setTelefono('');
      setCurp('');
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
      <summary>Corregir datos incompletos con vista previa</summary>
      <p>
        Solo teléfono y CURP. No modifica identidad, plantel ni inscripciones y no fusiona duplicados. Deja sin llenar
        lo que quieras conservar.
      </p>
      {error && <p role="alert">{error}</p>}
      {mensaje && <p role="status">{mensaje}</p>}
      <label>
        Expediente a corregir
        <select
          value={alumnoId}
          disabled={ocupado}
          onChange={(e) => {
            setAlumnoId(e.target.value);
            setPreview(null);
          }}
        >
          <option value="">Selecciona matrícula</option>
          {alumnos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.matricula}
            </option>
          ))}
        </select>
      </label>
      <label>
        Teléfono nuevo
        <input
          maxLength={20}
          value={telefono}
          disabled={ocupado}
          onChange={(e) => {
            setTelefono(e.target.value);
            setPreview(null);
          }}
        />
      </label>
      <label>
        CURP nueva
        <input
          maxLength={18}
          value={curp}
          disabled={ocupado}
          onChange={(e) => {
            setCurp(e.target.value.toUpperCase());
            setPreview(null);
          }}
        />
      </label>
      <button disabled={ocupado || !alumnoId || (!telefono && !curp)} onClick={() => void consultar()}>
        Previsualizar corrección
      </button>
      {preview && (
        <>
          <div className="tabla-contenedor">
            <table className="tabla">
              <caption>Cambios de {preview.matricula}</caption>
              <thead>
                <tr>
                  <th>Campo</th>
                  <th>Antes</th>
                  <th>Después</th>
                </tr>
              </thead>
              <tbody>
                {(['telefono', 'curp'] as const).map((c) => (
                  <tr key={c}>
                    <td>{c === 'telefono' ? 'Teléfono' : 'CURP'}</td>
                    <td>{preview.antes[c] || 'Sin registrar'}</td>
                    <td>{preview.despues[c] || 'Sin registrar'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button disabled={ocupado} onClick={() => void guardar()}>
            Confirmar corrección previsualizada
          </button>
        </>
      )}
    </details>
  );
}
