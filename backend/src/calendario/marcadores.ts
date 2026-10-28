export interface Marcador {
  clave: string; nombre: string; color: string; forma: 'FONDO' | 'INICIO' | 'FIN'; revision: number;
}
const datos: Array<[string, string, string, Marcador['forma']]> = [
  ['apertura', 'Ceremonia de apertura del ciclo escolar', '#83DF8B', 'FONDO'],
  ['evaluacion-ejecutiva', 'Evaluaciones modalidad ejecutiva', '#DDA1DA', 'FONDO'],
  ['evaluacion-escolarizada', 'Evaluaciones modalidad escolarizada', '#BFE5F1', 'FONDO'],
  ['colegiatura', 'Pago de colegiatura', '#F5C5B0', 'FONDO'],
  ['curriculares', 'Actividades curriculares', '#FFFF75', 'FONDO'],
  ['convocatoria-beca', 'Publicación de convocatoria para renovación de beca', '#DEC5C1', 'FONDO'],
  ['folios-beca', 'Asignación de folios de beca', '#ADF2A5', 'FONDO'],
  ['reinscripcion', 'Feria de reinscripción', '#F378C5', 'FONDO'],
  ['publicacion-notas', 'Publicación de calificaciones', '#FF2929', 'FONDO'],
  ['inicio-escolarizada', 'Inicio de clases modalidad escolarizada', '#146884', 'INICIO'],
  ['inicio-ejecutiva', 'Inicio de clases modalidad ejecutiva', '#91CC57', 'INICIO'],
  ['fin-escolarizada', 'Fin de cuatrimestre modalidad escolarizada', '#BF0093', 'FIN'],
  ['fin-ejecutiva', 'Fin de cuatrimestre modalidad ejecutiva', '#20B78E', 'FIN'],
  ['clausura-ejecutiva', 'Ceremonia de clausura y entrega de boletas modalidad ejecutiva', '#2CC638', 'FONDO'],
  ['clausura-escolarizada', 'Ceremonia de clausura y entrega de boletas modalidad escolarizada', '#9DFF62', 'FONDO'],
  ['inhabil', 'Día inhábil', '#BD9200', 'FONDO'],
];
export const MARCADORES_INICIALES: Marcador[] = datos.map(([clave, nombre, color, forma]) => ({ clave, nombre, color, forma, revision: 0 }));
