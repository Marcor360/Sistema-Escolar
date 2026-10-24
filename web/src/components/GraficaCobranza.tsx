import { useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { pesos } from '../utils/formato';

interface Punto { periodo: string; cobrado: number; alumnosQuePagaron?: number }
interface Serie { datos: Punto[]; moneda: string; base: string }
type Metrica = 'cobrado' | 'alumnosQuePagaron';
type Tipo = 'barras' | 'lineas';

export function GraficaCobranza({ plantelId }: { plantelId: string }) {
  const [serie, setSerie] = useState<Serie | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [revision, setRevision] = useState(0);
  const [tipo, setTipo] = useState<Tipo>('barras');
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
  const presentar = (n: number) => metrica === 'cobrado' ? pesos(n) : String(n);
  const maximo = Math.max(1, ...puntos.map(valor));
  const descripcion = puntos.map(p => `${p.periodo}: ${presentar(valor(p))}`).join('; ');
  const coordenadas = puntos.map((p, i) => ({
    x: 54 + i * (592 / Math.max(1, puntos.length - 1)),
    y: 200 - valor(p) / maximo * 164,
    punto: p,
  }));
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
      <label htmlFor="cobranza-tipo">Visualización</label>
      <select id="cobranza-tipo" value={tipo} onChange={e=>setTipo(e.target.value as Tipo)}>
        <option value="barras">Barras</option><option value="lineas">Líneas</option>
      </select>
    </div>
    {cargando ? <p role="status">Cargando gráfica de cobranza…</p> :
      error ? <p role="alert">No se pudo consultar la cobranza: {error}</p> :
      !serie || puntos.every(p => valor(p) === 0) ? <p>No hay ingresos confirmados ni alumnos con pago para la medida seleccionada.</p> :
      <>
        {tipo === 'barras' ? <div className="barras-cobranza" role="img" aria-label={descripcion}>
          {puntos.map(p => <div className="barra-cobranza" key={p.periodo}>
            <span className="barra-cobranza-valor">{presentar(valor(p))}</span>
            <div className="barra-cobranza-pista"><div className="barra-cobranza-relleno" style={{ height: `${valor(p) / maximo * 100}%` }} /></div>
            <span className="barra-cobranza-periodo">{p.periodo}</span>
          </div>)}
        </div> :
          <div className="grafica-lineas-contenedor">
            <svg viewBox="0 0 700 255" role="img" aria-label={descripcion} className="grafica-lineas" xmlns="http://www.w3.org/2000/svg">
              <line x1="54" y1="200" x2="646" y2="200" stroke="currentColor" opacity=".35" />
              <line x1="54" y1="36" x2="54" y2="200" stroke="currentColor" opacity=".35" />
              {[0, 0.5, 1].map(fraccion => <g key={fraccion}>
                <line x1="54" x2="646" y1={200-164*fraccion} y2={200-164*fraccion} stroke="currentColor" opacity=".12" />
                <text x="46" y={204-164*fraccion} textAnchor="end" fontSize="11" fill="currentColor">{presentar(maximo*fraccion)}</text>
              </g>)}
              <polyline points={coordenadas.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#14343b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {coordenadas.map(p=><g key={p.punto.periodo}>
                <circle cx={p.x} cy={p.y} r="5" fill="#c79a3c" stroke="#14343b" strokeWidth="2"><title>{p.punto.periodo}: {presentar(valor(p.punto))}</title></circle>
                <text x={p.x} y="225" textAnchor="middle" fontSize="12" fill="currentColor">{p.punto.periodo.slice(5)}</text>
              </g>)}
            </svg>
            <p className="texto-ayuda">Eje horizontal: meses. Eje vertical: {metrica === 'cobrado' ? 'pesos mexicanos' : 'alumnos'}.</p>
          </div>}
        <details><summary>Consultar valores exactos de la gráfica</summary><div className="tabla-contenedor"><table className="tabla">
          <thead><tr><th>Mes</th><th>Ingresos</th><th>Alumnos que pagaron</th></tr></thead>
          <tbody>{puntos.map(p=><tr key={p.periodo}><td>{p.periodo}</td><td>{pesos(p.cobrado)}</td><td>{p.alumnosQuePagaron ?? 0}</td></tr>)}</tbody>
        </table></div></details>
      </>}
  </section>;
}
