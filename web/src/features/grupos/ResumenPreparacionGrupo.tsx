import type { PreparacionGrupo } from './tipos';
export function ResumenPreparacionGrupo({ resumen }: { resumen?: PreparacionGrupo }) {
  if (!resumen) return <span>Resumen no disponible</span>;
  return <div className="preparacion-grupo">
    <span>{resumen.asignadas} materias asignadas</span>
    <span>{resumen.sinDocente} sin docente activo</span>
    <span>{resumen.inscritos} alumnos inscritos</span>
    {resumen.esperadas === null ? <span className="sello aviso">Sin periodo vinculado: revisa el plan</span>
      : resumen.esperadas === 0 ? <span className="sello aviso">Sin materias vinculadas al periodo</span>
      : <span className={resumen.pendientes ? 'sello aviso' : 'sello neutro'}>{resumen.pendientes} de {resumen.esperadas} materias del periodo por revisar</span>}
  </div>;
}
