import { SelectorBuscable } from './SelectorBuscable';
export interface ContextoAcademicoValor { nivelId: string; carreraId: string; periodoAcademicoId: string }
export const CONTEXTO_VACIO: ContextoAcademicoValor = { nivelId: '', carreraId: '', periodoAcademicoId: '' };
export function ContextoAcademicoSelector({ plantelId, cicloId, valor, cambiar, deshabilitado = false }:
  { plantelId: string; cicloId: string; valor: ContextoAcademicoValor; cambiar: (v: ContextoAcademicoValor) => void; deshabilitado?: boolean }) {
  return <fieldset disabled={deshabilitado}><legend>Contexto académico</legend>
    {!plantelId || !cicloId ? <p>Selecciona plantel y ciclo para consultar los catálogos.</p> : <>
      <SelectorBuscable<{ id: number; nombre: string }> ruta="/academico/catalogos/niveles" etiqueta="Nivel académico" valor={valor.nivelId}
        filtros={{ plantelId }} cambiar={(nivelId) => cambiar({ nivelId, carreraId: '', periodoAcademicoId: '' })} texto={(n) => n.nombre} />
      {valor.nivelId && <SelectorBuscable<{ id: number; nombre: string; versionPlan: string }> ruta="/academico/catalogos/carreras" etiqueta="Carrera y plan" valor={valor.carreraId}
        filtros={{ plantelId, nivelId: valor.nivelId }} cambiar={(carreraId) => cambiar({ ...valor, carreraId, periodoAcademicoId: '' })} texto={(c) => `${c.nombre} · Plan ${c.versionPlan}`} />}
      {valor.carreraId && <SelectorBuscable<{ id: number; nombre: string; tipo: string; numero: number }> ruta="/academico/catalogos/periodos" etiqueta="Periodo académico" valor={valor.periodoAcademicoId}
        filtros={{ plantelId, carreraId: valor.carreraId, cicloId }} cambiar={(periodoAcademicoId) => cambiar({ ...valor, periodoAcademicoId })} texto={(p) => `${p.nombre} · ${p.tipo} ${p.numero}`} />}
    </>}
  </fieldset>;
}
