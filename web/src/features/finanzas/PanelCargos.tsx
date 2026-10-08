import type * as React from 'react';
import { FormEvent } from 'react';
import { pesos, selloDeCargo } from '../../utils/formato';
import { SelectorBuscable } from '../../components/SelectorBuscable';
import { Paginador } from '../../components/Paginador';
import type { Alumno, Concepto, Ciclo, ResultadoCargos } from './tipos';
interface Props {
crearCargo: (e: FormEvent) => Promise<void>;
formCargo: { alumnoId: string; conceptoId: string; descripcion: string; monto: string; descuento: string; fechaVencimiento: string; };
setFormCargo: React.Dispatch<React.SetStateAction<{ alumnoId: string; conceptoId: string; descripcion: string; monto: string; descuento: string; fechaVencimiento: string; }>>;
conceptos: Concepto[];
enviando: boolean;
generarColegiaturas: (e: FormEvent) => Promise<void>;
formColegiaturas: { cicloId: string; periodo: string; };
setFormColegiaturas: React.Dispatch<React.SetStateAction<{ cicloId: string; periodo: string; }>>;
ciclos: Ciclo[];
aplicarRecargos: () => Promise<void>;
resultadoCargos: ResultadoCargos;
corregir: (tipo: 'cargos' | 'pagos', id: number) => void;
cargarCargos: (pagina?: number) => Promise<void>;
}
export function PanelCargos({ crearCargo, formCargo, setFormCargo, conceptos,  enviando, generarColegiaturas, formColegiaturas, setFormColegiaturas, ciclos, aplicarRecargos, resultadoCargos, corregir, cargarCargos }: Props) { return (<div id="panel-cargos" role="tabpanel" aria-labelledby="tab-cargos" tabIndex={0}>
          <section className="panel">
            <h2>Nuevo cargo individual</h2>
            <form onSubmit={crearCargo} className="fila">
              <SelectorBuscable<Alumno> ruta="/finanzas/alumnos" valor={formCargo.alumnoId} cambiar={(id) => setFormCargo({ ...formCargo, alumnoId: id })} etiqueta="Alumno" texto={(a) => `${a.matricula} — ${a.usuario.nombre} ${a.usuario.apellidoPaterno}`} />
              <div className="campo"><label htmlFor="finanzas-campo-1">Concepto</label>
                <select id="finanzas-campo-1"
                  required value={formCargo.conceptoId}
                  onChange={(e) => {
                    const concepto = conceptos.find((c) => c.id === Number(e.target.value));
                    setFormCargo({
                      ...formCargo,
                      conceptoId: e.target.value,
                      descripcion: concepto?.nombre ?? formCargo.descripcion,
                      monto: concepto && concepto.montoBase > 0 ? String(concepto.montoBase) : formCargo.monto,
                    });
                  }}
                >
                  <option value="">Selecciona…</option>
                  {conceptos.filter((c) => !['BECA', 'DESCUENTO', 'RECARGO'].includes(c.tipo)).map((c) => <option key={c.id} value={c.id}>{c.clave} — {c.nombre}</option>)}
                </select>
              </div>
              <div className="campo"><label htmlFor="finanzas-campo-2">Descripción</label>
                <input id="finanzas-campo-2" required value={formCargo.descripcion} onChange={(e) => setFormCargo({ ...formCargo, descripcion: e.target.value })} />
              </div>
              <div className="campo"><label htmlFor="finanzas-campo-3">Monto</label>
                <input id="finanzas-campo-3" type="number" min={0} step={0.01} required value={formCargo.monto} onChange={(e) => setFormCargo({ ...formCargo, monto: e.target.value })} />
              </div>
              <div className="campo"><label htmlFor="descuento-cargo">Beca / descuento</label><input id="descuento-cargo" type="number" min={0} max={formCargo.monto || undefined} step="0.01" value={formCargo.descuento} onChange={(e) => setFormCargo({ ...formCargo, descuento: e.target.value })} /></div><div className="campo"><label htmlFor="finanzas-campo-4">Vence</label>
                <input id="finanzas-campo-4" type="date" value={formCargo.fechaVencimiento} onChange={(e) => setFormCargo({ ...formCargo, fechaVencimiento: e.target.value })} />
              </div>
              <button disabled={enviando} className="boton">Registrar cargo</button>
            </form>
          </section>

          <section className="panel">
            <h2>Generar colegiaturas del periodo</h2>
            <form onSubmit={generarColegiaturas} className="fila">
              <div className="campo"><label htmlFor="finanzas-campo-5">Ciclo</label>
                <select id="finanzas-campo-5" required value={formColegiaturas.cicloId} onChange={(e) => setFormColegiaturas({ ...formColegiaturas, cicloId: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {ciclos.map((c) => <option key={c.id} value={c.id}>{c.clave}</option>)}
                </select>
              </div>
              <div className="campo"><label htmlFor="finanzas-campo-6">Periodo (AAAA-MM)</label>
                <input id="finanzas-campo-6" required pattern="\d{4}-\d{2}" placeholder="2026-09" value={formColegiaturas.periodo}
                  onChange={(e) => setFormColegiaturas({ ...formColegiaturas, periodo: e.target.value })} />
              </div>
              <button disabled={enviando} className="boton">Generar para inscritos</button>
              <button type="button" className="boton secundario" onClick={aplicarRecargos}>Aplicar recargos a vencidos</button>
            </form>
          </section>

          <table className="tabla">
            <thead><tr><th>Alumno</th><th>Descripción</th><th>Periodo</th><th>Vence</th><th className="derecha">Monto</th><th className="derecha">Recargo</th><th>Estatus</th><th>Correcciones</th></tr></thead>
            <tbody>
              {resultadoCargos.datos.map((c) => (
                <tr key={c.id}>
                  <td>{c.alumno.matricula}</td>
                  <td>{c.descripcion}</td>
                  <td>{c.periodo ?? '—'}</td>
                  <td>{c.fechaVencimiento ?? '—'}</td>
                  <td className="derecha monto">{pesos(c.monto - c.descuento)}</td>
                  <td className="derecha monto">{c.recargo > 0 ? pesos(c.recargo) : '—'}</td>
                  <td><span className={`sello ${selloDeCargo(c.estatus)}`}>{c.estatus}</span></td><td>{c.estatus !== 'CANCELADO' && <button disabled={enviando} onClick={() => corregir('cargos', c.id)}>Cancelar cargo</button>}</td>
                </tr>
              ))}
              {resultadoCargos.datos.length === 0 && <tr><td className="vacio" colSpan={7}>Sin cargos registrados.</td></tr>}
            </tbody>
          </table>
          <Paginador total={resultadoCargos.total} pagina={resultadoCargos.pagina} porPagina={resultadoCargos.porPagina} onCambio={cargarCargos} />
        </div>); }
