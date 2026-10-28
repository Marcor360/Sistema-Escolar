import { CSSProperties } from 'react';
import { archivosBase } from '../api/client';
import { useMarca, textoAccesible } from '../marca/MarcaContext';
export interface MarcadorCalendario {
  clave: string;
  nombre: string;
  color: string;
  forma: 'FONDO' | 'INICIO' | 'FIN';
  revision: number;
}
export interface EventoLamina {
  id: number;
  titulo: string;
  fechaInicio: string;
  fechaFin: string | null;
  imagenNombre: string | null;
  marcador?: MarcadorCalendario | null;
}
export const diaCalendario = (v: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(v));
export function SimboloMarcador({ marcador }: { marcador: MarcadorCalendario }) {
  return (
    <span
      aria-hidden="true"
      className={'calendario-simbolo forma-' + marcador.forma.toLowerCase()}
      style={{ backgroundColor: marcador.color }}
    />
  );
}
export function LaminaCalendario({
  meses,
  eventos,
  marcadores,
  ciclo,
  nivel,
  gestionar,
  seleccionar,
  compacto = true,
}: {
  compacto?: boolean;
  meses: string[];
  eventos: EventoLamina[];
  marcadores: MarcadorCalendario[];
  ciclo: { nombre: string; fechaInicio: string; fechaFin: string };
  nivel?: string;
  gestionar: boolean;
  seleccionar: (fecha: string) => void;
}) {
  const { marca } = useMarca();
  const leyenda = [...marcadores];
  for (const e of eventos)
    if (
      e.marcador &&
      !leyenda.some(
        (m) => m.nombre === e.marcador!.nombre && m.color === e.marcador!.color && m.forma === e.marcador!.forma,
      )
    )
      leyenda.push(e.marcador);
  return (
    <article className={'calendario-lamina' + (compacto ? ' calendario-compacto' : '') + (meses.length <= 4 ? ' calendario-corto' : '')} aria-label="Calendario institucional para imprimir">
      <header className="calendario-cabecera">
        {marca.logoUrl && <img src={archivosBase + marca.logoUrl} alt={'Logo de ' + marca.nombreInstitucion} />}
        <div>
          <p className="calendario-institucion">{marca.nombreInstitucion}</p>
          <h2>Calendario escolar {ciclo.nombre}</h2>
          {nivel && <p>{nivel}</p>}
          <p className="calendario-vigencia">
            {ciclo.fechaInicio} — {ciclo.fechaFin}
          </p>
        </div>
      </header>
      <div className="calendario-composicion">
        <div className="calendario-meses">
          {meses.map((m) => {
            const [anio, numero] = m.split('-').map(Number);
            const dias = new Date(Date.UTC(anio, numero, 0)).getUTCDate();
            const inicio = (new Date(Date.UTC(anio, numero - 1, 1)).getUTCDay() + 6) % 7;
            const celdas = Math.ceil((inicio + dias) / 7) * 7;
            return (
              <section className="calendario-mes" key={m}>
                <h3>
                  {new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
                    new Date(m + '-01T12:00:00Z'),
                  )}
                </h3>
                <div className="calendario-dias">
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => (
                    <span className="calendario-semana" aria-hidden="true" key={'d' + i}>
                      {d}
                    </span>
                  ))}
                  {Array.from({ length: celdas }, (_, celda) => {
                    const dia = celda - inicio + 1;
                    if (dia < 1 || dia > dias)
                      return <div className="calendario-hueco" key={'b' + celda} aria-hidden="true" />;
                    const fecha = m + '-' + String(dia).padStart(2, '0');
                    const fuera = fecha < ciclo.fechaInicio || fecha > ciclo.fechaFin;
                    const delDia = fuera
                      ? []
                      : eventos.filter(
                          (e) =>
                            !e.imagenNombre &&
                            diaCalendario(e.fechaInicio) <= fecha &&
                            diaCalendario(e.fechaFin ?? e.fechaInicio) >= fecha,
                        );
                    const fondos = delDia.flatMap((e) => (e.marcador?.forma === 'FONDO' ? [e.marcador.color] : []));
                    const fondo =
                      fondos.length > 1
                        ? `linear-gradient(to right, ${fondos.map((c, i) => `${c} ${(i * 100) / fondos.length}%, ${c} ${((i + 1) * 100) / fondos.length}%`).join(', ')})`
                        : fondos[0];
                    const estilo: CSSProperties = fondo
                      ? { background: fondo, color: fondos.length === 1 ? textoAccesible(fondos[0]) : '#000' }
                      : {};
                    return (
                      <div key={fecha} className={'calendario-celda' + (fuera ? ' fuera-ciclo' : '')} style={estilo}>
                        <button
                          type="button"
                          aria-label={
                            'Seleccionar ' +
                            fecha +
                            (delDia.length ? ': ' + delDia.map((e) => e.titulo).join('; ') : '')
                          }
                          disabled={!gestionar || fuera}
                          onClick={() => seleccionar(fecha)}
                        >
                          {dia}
                        </button>
                        {delDia.length > 0 && (
                          <ul className="calendario-marcas-dia">
                            {delDia.map((e) => (
                              <li key={e.id} title={(e.marcador ? e.marcador.nombre + ': ' : '') + e.titulo}>
                                {e.marcador && <SimboloMarcador marcador={e.marcador} />}
                                <span>{e.titulo}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        <aside className="calendario-leyenda" aria-label="Leyenda de marcadores">
          <h4>Marcadores</h4>
          <ul>
            {leyenda.map((m, i) => (
              <li key={m.clave + i}>
                <SimboloMarcador marcador={m} />
                <span>{m.nombre}</span>
              </li>
            ))}
          </ul>
          {!eventos.some((e) => !e.imagenNombre) && <p>Sin fechas publicadas en este ámbito.</p>}
          <p className="calendario-nota-impresion">
            Los colores identifican eventos; no modifican calificaciones, pagos ni asistencia.
          </p>
        </aside>
      </div>
    </article>
  );
}
