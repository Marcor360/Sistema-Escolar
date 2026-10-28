# Calendario institucional — candidata 1.30.0

Base main 1.29.0 (#211). Referencia visual entregada por el solicitante: lámina con logo, meses lunes–domingo, leyenda de colores y flechas. No se copian sus fechas ni se inventa el reglamento o un calendario oficial.

## Funciones

- Vista de ciclo completo (también anual) con los meses reales, incluso cuando cruza de año; mensual, agenda accesible e imagen institucional conservadas. Encabezado usa nombre y logo de Configuración de marca.
- Dieciséis marcadores iniciales: apertura; evaluaciones ejecutiva/escolarizada; colegiatura; actividades curriculares; convocatoria y folios de beca; reinscripción; publicación de notas; inicios/fines ejecutiva/escolarizada; clausuras y día inhábil.
- ADMINISTRATIVO, FINANZAS y SUPERADMIN configuran nombre, color hexadecimal y forma (fondo, flecha inicio o fin) por plantel autorizado. Admiten hasta 100 configuraciones persistidas por plantel; no se borran marcadores ni fechas anteriores. Los iniciales no generan filas ni eventos automáticamente.
- El cambio de un marcador actualiza su presentación en los calendarios del mismo plantel, incluidos los ciclos anteriores. Se registra antes/después en bitácora académica. Una revisión desactualizada recibe 409.
- Evento individual o rango inclusivo de días en America/Mexico_City. Múltiples eventos en un día conservan todos sus títulos/marcadores; los fondos se reparten en franjas. Se mantiene el tipo y la audiencia anteriores: elegir Pago no registra cargos, elegir Inhábil no modifica asistencia, ni una publicación de notas publica calificaciones.
- Se conservan eventos anteriores sin marcador, importación/exportación ICS, imágenes privadas, revisiones del evento, roles y alcance. Un marcador personalizado de otro plantel se rechaza al publicar o editar.
- Impresión nativa / Guardar PDF con logo, leyenda y colores, configuración inicial A3 horizontal; revisar ajustes y legibilidad de la impresora. PDF utiliza el ámbito y la vista cargados. Agenda mantiene el detalle textual.

## API y datos

GET `/calendario/marcadores` devuelve opciones iniciales; con plantelId autorizado devuelve la combinación de iniciales y personalizados del plantel. POST del mismo recurso configura un marcador con plantelId, nombre, color, forma y opcionalmente clave/revision. Sin clave crea uno nuevo. Los eventos aceptan marcadorClave opcional; cadena vacía lo desasocia sin borrar el marcador.

Migración incremental espejo `migracion_calendario_marcadores.sql`: tabla `calendario_marcadores` con unicidad plantel/clave y FK a plantel, más columna nullable `eventos_calendario.marcador_clave`. No actualiza datos previos. No ejecutar schema.sql completo. Aplicar con runner/DB_SYNC=false, respaldo/restore ensayado y liberación coordinada antes de producción. La app Expo conserva sus contratos; no añade gestión administrativa.

Las pruebas visuales usan datos sintéticos y API simulada; API/BD se verifica por separado en ambos motores. CI y evidencia por SHA en el PR. UAT-59–61 permanece pendiente; no acredita impresión física, datos de institución, despliegue ni aceptación de esta versión.
