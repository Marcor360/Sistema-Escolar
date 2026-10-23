import { useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { pesos } from '../utils/formato';

interface Punto { periodo: string; cobrado: number }
interface Serie { datos: Punto[]; moneda: string; base: string }

export function GraficaCobranza({ plantelId }: { plantelId: string }) {
  const [serie, setSerie] = useState<Serie | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [revision, setRevision] = useState(0);

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

  const maximo = Math.max(1, ...(serie?.datos.map((punto) => punto.cobrado) ?? [0]));
  return <section className="panel grafica-cobranza" aria-labelledby="titulo-grafica-cobranza">
    <div className="panel-cabecera">
      <div><p className="sobrelinea">COBRANZA</p><h2 id="titulo-grafica-cobranza">Ingresos mensuales</h2></div>
      <button className="boton secundario chico" disabled={cargando} onClick={() => setRevision((actual) => actual + 1)}>Actualizar gráfica</button>
    </div>
    <p>Pagos confirmados por mes y plantel de origen. No incluye pagos pendientes o anulados.</p>
    {cargando ? <p role="status">Cargando gráfica de cobranza…</p> :
      error ? <p role="alert">No se pudo consultar la cobranza: {error}</p> :
      !serie || serie.datos.every((punto) => punto.cobrado === 0) ? <p>No hay ingresos confirmados en los últimos seis meses.</p> :
      <div className="barras-cobranza" role="img" aria-label={serie.datos.map((punto) => `${punto.periodo}: ${pesos(punto.cobrado)}`).join('; ')}>
        {serie.datos.map((punto) => <div className="barra-cobranza" key={punto.periodo}>
          <span className="barra-cobranza-valor">{pesos(punto.cobrado)}</span>
          <div className="barra-cobranza-pista"><div className="barra-cobranza-relleno" style={{ height: `${(punto.cobrado / maximo) * 100}%` }} /></div>
          <span className="barra-cobranza-periodo">{punto.periodo}</span>
        </div>)}
      </div>}
  </section>;
}
