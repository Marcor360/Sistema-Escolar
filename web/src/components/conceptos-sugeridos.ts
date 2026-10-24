/** Ejemplos orientativos: FINANZAS debe revisar si proceden y definir tarifa antes de publicarlos. */
export const conceptosSugeridos = [
  { clave: 'EXTRA_SEC', nombre: 'Examen extraordinario de secundaria', nivel: 'SECUNDARIA' },
  { clave: 'REGULARIZACION', nombre: 'Curso de regularización', nivel: 'TODOS' },
  { clave: 'DUP_CERT', nombre: 'Duplicado de certificado', nivel: 'TODOS' },
  { clave: 'CONST_EST', nombre: 'Constancia de estudios', nivel: 'TODOS' },
  { clave: 'REP_CRED', nombre: 'Reposición de credencial', nivel: 'TODOS' },
  { clave: 'CURSO_COMP', nombre: 'Curso complementario opcional', nivel: 'TODOS' },
  { clave: 'EXTRA_BACH', nombre: 'Examen extraordinario de bachillerato', nivel: 'BACHILLERATO' },
  { clave: 'RECURS_BACH', nombre: 'Recursamiento de materia de bachillerato', nivel: 'BACHILLERATO' },
  { clave: 'CERT_PARCIAL', nombre: 'Certificado parcial de estudios', nivel: 'BACHILLERATO' },
  { clave: 'EXTRA_SUP', nombre: 'Evaluación extraordinaria de educación superior', nivel: 'SUPERIOR' },
  { clave: 'REC_MAT_SUP', nombre: 'Recursamiento de asignatura de educación superior', nivel: 'SUPERIOR' },
  { clave: 'TITULACION', nombre: 'Trámite institucional de titulación', nivel: 'SUPERIOR' },
  { clave: 'EXAM_PROF', nombre: 'Examen profesional o de grado', nivel: 'SUPERIOR' },
  { clave: 'CERT_TOTAL', nombre: 'Expedición de certificado total de estudios', nivel: 'SUPERIOR' },
  { clave: 'CONST_SS', nombre: 'Constancia administrativa de servicio social', nivel: 'SUPERIOR' },
  { clave: 'CERT_GRADO', nombre: 'Certificación institucional de grado', nivel: 'SUPERIOR' },
] as const;

export const nivelesSugerencia = ['TODOS', 'SECUNDARIA', 'BACHILLERATO', 'SUPERIOR'] as const;
export type NivelSugerencia = typeof nivelesSugerencia[number];
export function sugerenciasPorNivel(nivel: NivelSugerencia) {
  return conceptosSugeridos.filter(c => nivel === 'TODOS' ? c.nivel === 'TODOS' : c.nivel === nivel || c.nivel === 'TODOS');
}
