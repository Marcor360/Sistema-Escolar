import { FormEvent, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { MarcadorCalendario, SimboloMarcador } from './LaminaCalendario';
export function EditorMarcadores({
  plantelId,
  marcadores,
  guardado,
}: {
  plantelId: number;
  marcadores: MarcadorCalendario[];
  guardado: () => void;
}) {
  const [seleccion, setSeleccion] = useState('');
  const [nombre, setNombre] = useState(''),
    [color, setColor] = useState('#83df8b');
  const [forma, setForma] = useState<MarcadorCalendario['forma']>('FONDO');
  const [ocupado, setOcupado] = useState(false),
    [error, setError] = useState(''),
    [mensaje, setMensaje] = useState('');
  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      const anterior = marcadores.find((m) => m.clave === seleccion);
      await api.post('/calendario/marcadores', {
        plantelId,
        nombre: nombre.trim(),
        color,
        forma,
        ...(anterior ? { clave: anterior.clave, revision: anterior.revision } : {}),
      });
      setMensaje('Marcador guardado para este plantel.');
      guardado();
      setSeleccion('');
      setNombre('');
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <details className="calendario-editor">
      <summary>Configurar marcadores y colores del plantel</summary>
      <p>Los cambios se guardan y se reflejan en los calendarios del plantel. No crean fechas ni avisos.</p>
      <form className="fila" onSubmit={guardar}>
        <label>
          Marcador para configurar
          <select
            disabled={ocupado}
            value={seleccion}
            onChange={(e) => {
              setSeleccion(e.target.value);
              setError('');
              setMensaje('');
              const m = marcadores.find((m) => m.clave === e.target.value);
              setNombre(m?.nombre ?? '');
              setColor(m?.color ?? '#83df8b');
              setForma(m?.forma ?? 'FONDO');
            }}
          >
            <option value="">Agregar otro marcador</option>
            {marcadores.map((m) => (
              <option key={m.clave} value={m.clave}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nombre del marcador
          <input
            required
            maxLength={150}
            value={nombre}
            disabled={ocupado}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <label>
          Color del marcador
          <input type="color" value={color} disabled={ocupado} onChange={(e) => setColor(e.target.value)} />
        </label>
        <label>
          Forma del marcador
          <select
            value={forma}
            disabled={ocupado}
            onChange={(e) => setForma(e.target.value as MarcadorCalendario['forma'])}
          >
            <option value="FONDO">Fondo de día</option>
            <option value="INICIO">Flecha de inicio →</option>
            <option value="FIN">Flecha de fin ←</option>
          </select>
        </label>
        <span aria-label="Vista previa del marcador">
          <SimboloMarcador marcador={{ clave: '', nombre, color, forma, revision: 0 }} /> {nombre || 'Nuevo marcador'}
        </span>
        <button disabled={ocupado || !nombre.trim()}>{ocupado ? 'Guardando marcador…' : 'Guardar marcador'}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {mensaje && <p role="status">{mensaje}</p>}
    </details>
  );
}
