import { EntityManager } from 'typeorm';
import { AperturaCartera, Grupo } from '../entities';
import { preparacionDeGrupos } from '../academico/preparacion-grupos';
/** El llamador autoriza la apertura antes de consultar su grupo. No notifica por correo. */
export async function pendientesApertura(m: EntityManager, a: AperturaCartera) {
  const avisos: string[] = [];
  const contexto = a.contextoJson ? JSON.parse(a.contextoJson) as { carreraId?: number; periodoAcademicoId?: number } : null;
  if (contexto && (!contexto.carreraId || !contexto.periodoAcademicoId)) avisos.push('Falta completar carrera/plan y periodo académico para asignar grupo.');
  const grupoId = a.solicitud?.grupoId;
  if (!grupoId) { avisos.push('El alumno todavía no tiene grupo asignado.'); return avisos; }
  const grupo = await m.getRepository(Grupo).findOneBy({ id: grupoId, plantelId: a.plantelId });
  if (!grupo) { avisos.push('El grupo requiere revisión por Control Escolar.'); return avisos; }
  const resumen = (await preparacionDeGrupos(m, [grupo])).get(grupoId)!;
  if (!resumen.asignadas) avisos.push('El grupo todavía no tiene materias asignadas.');
  else if (resumen.pendientes) avisos.push(`Faltan ${resumen.pendientes} materias del periodo por asignar al grupo.`);
  if (resumen.sinDocente) avisos.push(`Hay ${resumen.sinDocente} materias del grupo sin profesor activo asignado.`);
  return avisos;
}
