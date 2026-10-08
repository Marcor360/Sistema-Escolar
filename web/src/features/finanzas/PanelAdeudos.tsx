import { SeguimientoCobranza } from '../../components/SeguimientoCobranza';
import { pesos, selloDeCargo } from '../../utils/formato';
import { Paginador } from '../../components/Paginador';
import type { Adeudo } from './tipos';
interface Props {
enviando: boolean;
enviarAvisos: () => Promise<void>;
descargarExcel: () => Promise<void>;
adeudos: Adeudo[];
corregir: (tipo: 'cargos' | 'pagos', id: number) => void;
totalAdeudos: number;
paginaAdeudos: number;
cargarAdeudos: (pagina?: number) => Promise<void>;
}
export function PanelAdeudos({ enviando, enviarAvisos, descargarExcel, adeudos, corregir, totalAdeudos, paginaAdeudos, cargarAdeudos }: Props) { return (<div id="panel-adeudos" role="tabpanel" aria-labelledby="tab-adeudos" tabIndex={0}>
          <div className="acciones" style={{ marginBottom: 14 }}>
            <button disabled={enviando} className="boton" onClick={enviarAvisos}>Programar avisos de cobranza</button>
            <button className="boton secundario" onClick={descargarExcel}>Descargar Excel de adeudos</button>
          </div>
          <table className="tabla">
            <thead><tr><th>Alumno</th><th>Concepto</th><th>Vence</th><th className="derecha">Total</th><th className="derecha">Pagado</th><th className="derecha">Saldo</th><th>Estatus</th><th>Correcciones</th></tr></thead>
            <tbody>
              {adeudos.map((c) => (
                <tr key={c.id}>
                  <td>{c.alumno.matricula} — {c.alumno.usuario.nombre} {c.alumno.usuario.apellidoPaterno}</td>
                  <td>{c.descripcion}</td>
                  <td>{c.fechaVencimiento ?? '—'}</td>
                  <td className="derecha monto">{pesos(c.total)}</td>
                  <td className="derecha monto">{pesos(c.pagado)}</td>
                  <td className="derecha monto"><b>{pesos(c.saldo)}</b></td>
                  <td><span className={`sello ${selloDeCargo(c.estatus)}`}>{c.estatus}</span></td><td>{c.estatus !== 'CANCELADO' && <button disabled={enviando} onClick={() => corregir('cargos', c.id)}>Cancelar cargo</button>}</td>
                </tr>
              ))}
              {adeudos.length === 0 && <tr><td className="vacio" colSpan={7}>Sin adeudos: todos los cargos están cubiertos.</td></tr>}
            </tbody>
          </table>
          <SeguimientoCobranza /><Paginador total={totalAdeudos} pagina={paginaAdeudos} porPagina={20} onCambio={cargarAdeudos} />
        </div>); }
