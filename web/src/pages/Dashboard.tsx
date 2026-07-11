import { api } from '../api/client';
import { Encabezado } from '../components/Encabezado';
import { useDatos } from '../hooks/useDatos';
import { pesos, fechaHora } from '../utils/formato';
import { useState } from 'react';

interface Evento {
  id: number;
  titulo: string;
  tipo: string;
  fechaInicio: string;
}

interface Resumen {
  alumnosActivos: number;
  docentesActivos: number;
  grupos: number;
  saldoPendiente: number;
  cargosConAdeudo: number;
  cobradoMes: number;
}

interface Plantel { id: number; nombre: string }

export default function DashboardPage() {
  const [plantelId, setPlantelId] = useState('');
  const { datos: planteles } = useDatos<Plantel[]>(
    () => api.get('/planteles/mios').then((r) => r.data),
    [],
  );
  const { datos: resumen, cargando, error, recargar, setDatos: setResumen } = useDatos<Resumen | null>(
    () => api.get('/reportes/resumen').then((r) => r.data),
    null,
  );
  const filtrarPlantel = (valor: string) => {
    setPlantelId(valor);
    api.get('/reportes/resumen', { params: valor ? { plantelId: valor } : {} })
      .then((r) => setResumen(r.data));
  };
  const hoy = new Date();
  const en30dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const { datos: eventos } = useDatos<Evento[]>(
    () => api.get('/calendario', {
      params: { desde: hoy.toISOString(), hasta: en30dias.toISOString() },
    }).then((r) => r.data),
    [],
  );

  return (
    <>
      <Encabezado titulo="Panel general" detalle="Resumen académico y financiero al día de hoy" />
      {planteles.length > 1 && (
        <div className="fila" style={{ marginBottom: 16 }}>
          <div className="campo">
            <label>Ver plantel</label>
            <select value={plantelId} onChange={(e) => filtrarPlantel(e.target.value)}>
              <option value="">Todos mis planteles</option>
              {planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        </div>
      )}
      {cargando && <p className="detalle">Cargando indicadores…</p>}
      {error && (
        <p className="mensaje-error">
          {error} <button className="boton secundario chico" onClick={recargar}>Reintentar</button>
        </p>
      )}
      {resumen && (
        <div className="kpis">
          <div className="kpi"><div className="valor">{resumen.alumnosActivos}</div><div className="etiqueta">Alumnos activos</div></div>
          <div className="kpi"><div className="valor">{resumen.docentesActivos}</div><div className="etiqueta">Docentes activos</div></div>
          <div className="kpi"><div className="valor">{resumen.grupos}</div><div className="etiqueta">Grupos</div></div>
          <div className="kpi"><div className="valor monto">{pesos(resumen.cobradoMes)}</div><div className="etiqueta">Cobrado este mes</div></div>
          <div className="kpi"><div className="valor monto">{pesos(resumen.saldoPendiente)}</div><div className="etiqueta">Saldo pendiente</div></div>
          <div className="kpi"><div className="valor">{resumen.cargosConAdeudo}</div><div className="etiqueta">Cargos con adeudo</div></div>
        </div>
      )}

      {eventos.length > 0 && (
        <section className="panel" style={{ marginTop: 20 }}>
          <h2>Próximos eventos (30 días)</h2>
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Evento</th><th>Tipo</th></tr></thead>
            <tbody>
              {eventos.slice(0, 6).map((ev) => (
                <tr key={ev.id}>
                  <td>{fechaHora(ev.fechaInicio)}</td>
                  <td>{ev.titulo}</td>
                  <td><span className="sello neutro">{ev.tipo}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
