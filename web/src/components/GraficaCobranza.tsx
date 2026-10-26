import { GraficaIndicador } from './GraficaIndicador';
import { useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { pesos } from '../utils/formato';

interface Punto { periodo: string; cobrado: number; alumnosQuePagaron?: number }
interface Serie { datos: Punto[]; moneda: string; base: string }
type Metrica = 'cobrado' | 'alumnosQuePagaron';


export function GraficaCobranza({ plantelId }: { plantelId: string }) {
  const [serie, setSerie] = useState<Serie | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [revision, setRevision] = useState(0);

  const [metrica, setMetrica] = useState<Metrica>('cobrado');

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    setSerie(null);
    api.get<Serie>('/reportes/cobranza/serie', { params: plantelId ? { plantelId: Number(plantelId) } : {} })
      .then(({ data }) => { if (vigente) setSerie(data); })
      .catch((err: unknown) => { if (vigente) setError(mensajeDeError(err)); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [plantelId, revision]);

  const puntos = serie?.datos ?? [];
  const valor = (p: Punto) => metrica === 'cobrado' ? p.cobrado : p.alumnosQuePagaron ?? 0;
  return <section className="panel grafica-cobranza" aria-labelledby="titulo-grafica-cobranza">
    <div className="panel-cabecera">
      <div><p className="sobrelinea">COBRANZA</p><h2 id="titulo-grafica-cobranza">Evolución de pagos de seis meses</h2></div>
      <button className="boton secundario chico" type="button" disabled={cargando} onClick={() => setRevision(actual => actual + 1)}>Actualizar gráfica</button>
    </div>
    <p>Solo pagos confirmados por fecha de registro y plantel de origen. Los alumnos se cuentan una vez por mes, aunque hagan varios pagos.</p>
    <div className="fila grafica-filtros">
      <label htmlFor="cobranza-metrica">Medida</label>
      <select id="cobranza-metrica" value={metrica} onChange={e=>setMetrica(e.target.value as Metrica)}>
        <option value="cobrado">Ingresos cobrados (MXN)</option>
        <option value="alumnosQuePagaron">Alumnos con pagos confirmados</option>
      </select>

    </div>
    {cargando ? <p role="status">Cargando gráfica de cobranza…</p> :
      error ? <p role="alert">No se pudo consultar la cobranza: {error}</p> :
      !serie || puntos.every(p => valor(p) === 0) ? <p>No hay ingresos confirmados ni alumnos con pago para la medida seleccionada.</p> :
      <>
        <GraficaIndicador titulo={metrica === 'cobrado' ? 'Cobranza mensual' : 'Alumnos con pago por mes'} detalle={serie.base} datos={puntos.map(p=>({id:p.periodo,etiqueta:p.periodo,valor:valor(p)}))} moneda={metrica==='cobrado'} temporal/>

        <details><summary>Consultar valores exactos de la gráfica</summary><div className="tabla-contenedor"><table className="tabla">
          <thead><tr><th>Mes</th><th>Ingresos</th><th>Alumnos que pagaron</th></tr></thead>
          <tbody>{puntos.map(p=><tr key={p.periodo}><td>{p.periodo}</td><td>{pesos(p.cobrado)}</td><td>{p.alumnosQuePagaron ?? 0}</td></tr>)}</tbody>
        </table></div></details>
      </>}
  </section>;
}
