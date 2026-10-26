import { useId, useState } from 'react';
import { pesos } from '../utils/formato';
import './graficas-indicadores.css';
export interface PuntoIndicador {
  id: string;
  etiqueta: string;
  valor: number;
}
export function GraficaIndicador({
  titulo,
  detalle,
  datos,
  moneda = false,
  temporal = false,
}: {
  titulo: string;
  detalle: string;
  datos: PuntoIndicador[];
  moneda?: boolean;
  temporal?: boolean;
}) {
  const id = useId(),
    [tipo, setTipo] = useState<'barras' | 'lineas'>('barras'),
    [seleccion, setSeleccion] = useState<string | null>(null),
    [limite, setLimite] = useState(12);
  const filas = datos.filter((d) => Number.isFinite(d.valor)),
    visibles = filas.slice(0, limite),
    max = Math.max(1, ...visibles.map((d) => d.valor)),
    total = filas.reduce((n, d) => n + d.valor, 0),
    presentar = (n: number) => (moneda ? pesos(n) : n.toLocaleString('es-MX'));
  const ancho = Math.max(700, visibles.length * 62 + 130),
    alto = 300,
    izquierda = 100,
    base = 235,
    espacio = (ancho - izquierda - 35) / Math.max(1, visibles.length),
    coords = visibles.map((d, i) => ({ ...d, x: izquierda + espacio * (i + 0.5), y: base - (d.valor / max) * 180 }));
  const elegido = filas.find((d) => d.id === seleccion);
  return (
    <section className="indicador-grafica panel" aria-labelledby={id + '-titulo'}>
      <header className="indicador-cabecera">
        <div>
          <p className="sobrelinea">{temporal ? 'EVOLUCIÓN' : 'COMPARATIVA'}</p>
          <h2 id={id + '-titulo'}>{titulo}</h2>
          <p>{detalle}</p>
        </div>
        <div className="indicador-conmutador" role="group" aria-label={'Presentación de ' + titulo}>
          {(['barras', 'lineas'] as const).map((t) => (
            <button className="boton" type="button" key={t} aria-pressed={tipo === t} onClick={() => setTipo(t)}>
              {t === 'barras' ? 'Barras' : 'Líneas'}
            </button>
          ))}
        </div>
      </header>
      {!filas.length ? (
        <p className="indicador-vacio">Sin registros para los filtros seleccionados.</p>
      ) : (
        <>
          <div className="indicador-resumen">
            <div>
              <span>{temporal ? 'Acumulado del intervalo' : 'Suma de categorías'}</span>
              <strong>{presentar(total)}</strong>
            </div>
            <div>
              <span>Mayor valor</span>
              <strong>{presentar(Math.max(...filas.map((d) => d.valor)))}</strong>
            </div>
            <label>
              Categorías visibles
              <select value={limite} onChange={(e) => setLimite(Number(e.target.value))}>
                <option value={12}>12</option>
                <option value={24}>24</option>
                <option value={Math.max(25, filas.length)}>Todas ({filas.length})</option>
              </select>
            </label>
          </div>
          <div className="indicador-lienzo" tabIndex={0} role="region" aria-label={'Gráfica desplazable: ' + titulo}>
            <svg
              viewBox={`0 0 ${ancho} ${alto}`}
              style={{ minWidth: Math.min(ancho, 700) }}
              role="img"
              aria-label={titulo + ': ' + visibles.map((d) => d.etiqueta + ' ' + presentar(d.valor)).join('; ')}
            >
              <defs>
                <linearGradient id={id + '-degradado'} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--pizarra)" stopOpacity=".28" />
                  <stop offset="100%" stopColor="var(--pizarra)" stopOpacity=".02" />
                </linearGradient>
              </defs>
              {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                <g key={f}>
                  <line
                    x1={izquierda}
                    x2={ancho - 25}
                    y1={base - f * 180}
                    y2={base - f * 180}
                    stroke="currentColor"
                    opacity=".12"
                    strokeDasharray={f ? '4 5' : undefined}
                  />
                  <text x={izquierda - 12} y={base - f * 180 + 4} textAnchor="end" fill="currentColor" fontSize="11">
                    {moneda
                      ? new Intl.NumberFormat('es-MX', {
                          notation: 'compact',
                          style: 'currency',
                          currency: 'MXN',
                        }).format(max * f)
                      : new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(max * f)}
                  </text>
                </g>
              ))}
              {tipo === 'lineas' && coords.length > 0 && (
                <>
                  <path
                    d={`M ${coords[0].x} ${base} L ${coords.map((c) => c.x + ' ' + c.y).join(' L ')} L ${coords[coords.length - 1].x} ${base} Z`}
                    fill={'url(#' + id + '-degradado)'}
                  />
                  <polyline
                    points={coords.map((c) => c.x + ',' + c.y).join(' ')}
                    fill="none"
                    stroke="var(--tinta)"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  />
                </>
              )}
              {coords.map((c, i) => (
                <g key={c.id}>
                  {tipo === 'barras' ? (
                    <rect
                      x={c.x - Math.min(38, espacio * 0.6) / 2}
                      y={c.y}
                      width={Math.min(38, espacio * 0.6)}
                      height={Math.max(0, base - c.y)}
                      rx="6"
                      stroke="currentColor"
                      strokeOpacity=".3"
                      fill={seleccion === c.id ? 'var(--dorado)' : 'var(--pizarra)'}
                    >
                      <title>
                        {c.etiqueta}: {presentar(c.valor)}
                      </title>
                    </rect>
                  ) : (
                    <circle cx={c.x} cy={c.y} r="5" fill="var(--dorado)" stroke="var(--tinta)" strokeWidth="2">
                      <title>
                        {c.etiqueta}: {presentar(c.valor)}
                      </title>
                    </circle>
                  )}
                  <text x={c.x} y={base + 24} textAnchor="middle" fontSize="12" fill="currentColor">
                    {temporal ? c.etiqueta : i + 1}
                  </text>
                </g>
              ))}
            </svg>
          </div>
          <p className="texto-ayuda">
            {temporal
              ? 'Eje horizontal: meses.'
              : tipo === 'lineas'
                ? 'Las líneas unen categorías en el orden mostrado; no representan una tendencia temporal.'
                : 'Eje horizontal: categorías numeradas.'}{' '}
            Eje vertical: {moneda ? 'pesos mexicanos' : 'alumnos'}. Los ceros son valores registrados.
          </p>
          <div className="indicador-leyenda" aria-label={'Seleccionar categoría de ' + titulo}>
            {visibles.map((d, i) => (
              <button className="boton" key={d.id} type="button" aria-pressed={seleccion === d.id} onClick={() => setSeleccion(d.id)}>
                <span>{i + 1}</span>
                {d.etiqueta}
              </button>
            ))}
          </div>
          {elegido && (
            <p role="status">
              {elegido.etiqueta}: <strong>{presentar(elegido.valor)}</strong>
            </p>
          )}
          <details>
            <summary>Valores exactos de {titulo}</summary>
            <div className="tabla-contenedor">
              <table className="tabla">
                <caption>{titulo} · todas las categorías</caption>
                <thead>
                  <tr>
                    <th>{temporal ? 'Mes' : 'Categoría'}</th>
                    <th>{moneda ? 'Ingreso aplicado (MXN)' : 'Alumnos'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((d) => (
                    <tr key={d.id}>
                      <td>{d.etiqueta}</td>
                      <td>{presentar(d.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
