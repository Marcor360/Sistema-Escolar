import type * as React from 'react';
import { FormEvent } from 'react';
import { pesos } from '../../utils/formato';
import { SelectorBuscable } from '../../components/SelectorBuscable';
import { Paginador } from '../../components/Paginador';
import type { Alumno, Cargo, ResultadoPagos } from './tipos';
interface Props {
registrarPago: (e: FormEvent) => Promise<void>;
formPago: { alumnoId: string; cargoId: string; monto: string; metodo: string; referencia: string; };
setFormPago: React.Dispatch<React.SetStateAction<{ alumnoId: string; cargoId: string; monto: string; metodo: string; referencia: string; }>>;
enviando: boolean;
resultadoPagos: ResultadoPagos;
corregir: (tipo: 'cargos' | 'pagos', id: number) => void;
cargarPagos: (pagina?: number) => Promise<void>;
}
export function PanelPagos({ registrarPago, formPago, setFormPago, enviando, resultadoPagos, corregir, cargarPagos }: Props) { return (<div id="panel-pagos" role="tabpanel" aria-labelledby="tab-pagos" tabIndex={0}>
          <section className="panel">
            <h2>Registrar pago manual</h2>
            <form onSubmit={registrarPago} className="fila">
              <SelectorBuscable<Alumno> ruta="/finanzas/alumnos" valor={formPago.alumnoId} cambiar={(id) => setFormPago({ ...formPago, alumnoId: id, cargoId: '' })} etiqueta="Alumno" texto={(a) => `${a.matricula} — ${a.usuario.nombre} ${a.usuario.apellidoPaterno}`} />
              <SelectorBuscable<Cargo> ruta="/finanzas/cargos" valor={formPago.cargoId} cambiar={(id) => setFormPago({ ...formPago, cargoId: id })}
                etiqueta="Cargo" deshabilitado={!formPago.alumnoId} filtros={{ alumnoId: Number(formPago.alumnoId) || undefined }} texto={(c) => `${c.descripcion} — ${pesos(c.monto - c.descuento + c.recargo)} · ${c.estatus}`} />
              <div className="campo"><label htmlFor="finanzas-campo-7">Monto</label>
                <input id="finanzas-campo-7" type="number" min={0.01} step={0.01} required value={formPago.monto} onChange={(e) => setFormPago({ ...formPago, monto: e.target.value })} />
              </div>
              <div className="campo"><label htmlFor="finanzas-campo-8">Método</label>
                <select id="finanzas-campo-8" value={formPago.metodo} onChange={(e) => setFormPago({ ...formPago, metodo: e.target.value })}>
                  <option>EFECTIVO</option><option>TRANSFERENCIA</option><option>TARJETA</option>
                </select>
              </div>
              <div className="campo"><label htmlFor="finanzas-campo-9">Referencia</label>
                <input id="finanzas-campo-9" value={formPago.referencia} onChange={(e) => setFormPago({ ...formPago, referencia: e.target.value })} />
              </div>
              <button disabled={enviando} className="boton">Registrar pago</button>
            </form>
          </section>

          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Alumno</th><th className="derecha">Monto</th><th>Método</th><th>Referencia</th><th>Estatus</th><th>Correcciones</th></tr></thead>
            <tbody>
              {resultadoPagos.datos.map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.fechaPago).toLocaleString('es-MX')}</td>
                  <td>{p.alumno.matricula} — {p.alumno.usuario.nombre} {p.alumno.usuario.apellidoPaterno}</td>
                  <td className="derecha monto">{pesos(p.monto)}</td>
                  <td>{p.metodo}</td>
                  <td>{p.referencia ?? '—'}</td>
                  <td><span className={`sello ${p.estatus === 'CONFIRMADO' ? 'ok' : 'aviso'}`}>{p.estatus}</span></td><td>{p.estatus === 'CONFIRMADO' && p.metodo !== 'PASARELA' && <button disabled={enviando} onClick={() => corregir('pagos', p.id)}>Anular pago</button>}</td>
                </tr>
              ))}
              {resultadoPagos.datos.length === 0 && <tr><td className="vacio" colSpan={6}>Sin pagos registrados.</td></tr>}
            </tbody>
          </table>
          <Paginador total={resultadoPagos.total} pagina={resultadoPagos.pagina} porPagina={resultadoPagos.porPagina} onCambio={cargarPagos} />
        </div>); }
