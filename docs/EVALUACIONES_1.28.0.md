# Evaluaciones — candidata 1.28.0

Requisitos confirmados por el solicitante en #139 el 28/oct/2026. Incluye #208 (entregas y conservación 1.27.59), fusionado en una rama intermedia pero todavía fuera de main 1.27.58. El PR nuevo se dirige a main e incorpora ambas entregas. No acredita despliegue ni UAT institucional de esta candidata.

## Comportamiento

- Cuatro parciales mensuales, escala 0–10 y aprobación desde 6. Mismo régimen para niveles, planteles y grupos personalizados; se aplican los permisos existentes por clase y plantel.
- Cada parcial aporta 25 % a una propuesta automática. No es una Final definitiva hasta una aprobación explícita. La nota Final manual (`parcial=0`) sustituye el resultado calculado, incluso si vale cero o faltan parciales. Solo el profesor asignado o personal autorizado puede capturarla; corregir una nota existente exige motivo y queda en historial. No permite editar periodos o ciclos cerrados sin reapertura autorizada.
- Captura por criterios: profesor define 1–20 nombres y porcentajes positivos con hasta dos decimales, suma exactamente 100 %. Cada alumno debe tener una nota 0–10 por criterio; vacío no significa cero. Cálculo en NestJS mediante enteros, sin redondear parciales; hasta seis decimales persistidos en parciales. La Final admite hasta ocho decimales para conservar exactamente su media, sin activar una regla de redondeo. Criterios y notas usados quedan como instantánea en el historial de cada captura. No se recalculan notas anteriores al cambiar los criterios de una captura nueva.
- La UI permite volver a usar los criterios del último cálculo visible en el historial. No es un catálogo institucional de rúbricas ni un cálculo automático a partir de entregas: `Actividad.ponderacion` sigue siendo seguimiento, y las notas de cada criterio se capturan expresamente.
- Asistencias PRESENTE/FALTA/RETARDO/JUSTIFICADA ya existen en Seguimiento: no intervienen en el cálculo ni impiden examen. NP no se implementa ni se transforma en cero por inferencia.
- Boletas, concentrados, actas informativas, importación CSV/XLSX, analítica y Expo consultan el mismo régimen. P4 se ordena antes de Final. Una Final manual abierta impide publicar la boleta y cerrar el ciclo aunque estén cerrados los parciales; una Final manual cerrada puede sustituirlos para el resultado.
- Entregas y recursamientos también capturan según la escala de la clase. Mantienen originales y escala; las correcciones de entregas registran antes/después en bitácora académica. El recursamiento conserva su intento y no modifica la nota de la inscripción principal.
- Los meses son la duración institucional declarada de P1–P4. No se generan fechas de bloqueo ni cierres automáticos: se conserva la gestión autorizada existente, sin inventar un calendario de tercera semana.

## Transición sin pérdida

`grupo_materias.regimen_evaluacion`: clases de ciclos existentes no cerrados y clases nuevas usan `CUATRO_PARCIALES_10`. Los ciclos ya CERRADO quedan en `LEGADO_100`, con P1–P3, Final independiente y reportes originales. Cerrar un ciclo nuevo no cambia su régimen.

`calificaciones.escala_maxima` conserva la escala original (100 para filas previas; 10 para nuevas capturas del régimen nuevo). Una nota antigua 85/100 se lee como 8.5/10 en una clase en curso; su fila continúa en 85/100 hasta una corrección explícita, que conserva valor y escala anteriores en el historial. Ninguna migración divide, recalcula o elimina calificaciones, inscripciones, pagos o historiales. La equivalencia de lectura es lineal, 100 → 10, conservando los originales para conciliación.

El API expone `calificacionOriginal`, `escalaOriginal`, `escalaMaxima` y `regimenEvaluacion`. Las plantillas CSV/XLSX nuevas incluyen `escalaMaxima` y el importador exige 10 explícito en el régimen nuevo; un archivo anterior se rechaza hasta usar la plantilla actual. Los clientes nuevos envían `escalaMaxima=10` al capturar en el régimen nuevo. Un cliente antiguo no puede guardar silenciosamente un 8 interpretado en otra escala: recibe 409 y debe actualizarse. API, web y app deben liberarse coordinadamente.

## Redondeo pendiente

No se activa redondeo automático de la nota final: los ejemplos iniciales 7.5→6 / 7.6→8 contradicen la regla posterior 5.5→5 / 5.6→7 «igual con todo». Se muestra el resultado decimal y el docente puede consignar la Final manual que corresponda. No sustituir estas instrucciones por `Math.round`, ni recortar notas fuera del rango para simular una norma. La versión no presenta el redondeo institucional como terminado.

## Migraciones y operación

Aplicar mediante el runner, en ambos motores:

1. `migracion_evaluaciones_cuatro_parciales.sql`: régimen por clase, escala original, precisión e instantáneas de cálculo en historial.
2. `migracion_escalas_entregas_recursamiento.sql`: escala original de entregas e intentos; precisión e historial de recursamiento.
3. `migracion_precision_entregas.sql`: amplía entregas a seis decimales; se aplica también si ya se ensayaron las dos migraciones anteriores.

El runner también incorpora `migracion_entregas_texto_fecha_documental.sql` de #208 si aún falta en la base. Para habilitar entregas de 100 MiB, revisar IIS/ARR (multipart 110 MiB y timeout), según su contrato.

Son cambios aditivos y ampliaciones de precisión; MySQL y SQL Server mantienen los mismos datos. Requieren respaldo SQL **y** uploads, restore ensayado y mantenimiento autorizado antes de aplicarse a una base institucional. No ejecutar schema.sql completo ni DB_SYNC. Rollback de código no revierte DDL: conservar versión compatible y originales; no borrar columnas o notas nuevas para retroceder.

## Verificación

Las pruebas agregadas cubren precisión, P4 faltante, Final manual cero/sin parciales, publicación con Final abierta, porcentajes inválidos, equivalencia sin escritura, importación y exportación, escala de entregas, permisos y cierre. Los resultados concretos de comandos y ambos motores se registran en el PR para su SHA. UAT-47–52 queda pendiente; aceptación previa de Android no acredita esta nueva pantalla/versión. Los formatos continúan siendo informativos, sin inventar firmas, sellos ni folios oficiales.

## Regresión de conservación por plantel

Se corrige el hallazgo de revisión de #208: después de una transferencia, el inventario filtra por los planteles autorizados de los grupos originales, además del expediente actual. Control escolar del destino no ve ciclos ni conteos de adjuntos del origen; SUPERADMIN conserva consulta global. No se mueven ni eliminan archivos.

## Contratos de API

| Operación | Contrato |
| --- | --- |
| Captura directa | POST `/calificaciones/captura`: `grupoMateriaId`, `parcial` (0–4), `escalaMaxima: 10`, `items` con alumno/nota y motivo al corregir |
| Captura ponderada | POST `/calificaciones/captura-ponderada`: clase/parcial (1–4), criterios `{nombre, porcentaje}`, items `{alumnoId, notas: number[]}` en el mismo orden; motivo al sustituir |
| Estado y cierre | GET/PATCH `/calificaciones/periodos/:clase/:parcial`; metadatos de régimen, escala y parciales; gestión por Control Escolar |
| Historial | GET `/calificaciones/periodos/:clase/:parcial/historial`: valores y escalas antes/después, autor, motivo e instantánea de criterios |
| Alumno | GET `/calificaciones/mias` y `/calificaciones/mias/listado`: resultado compartido, escala y originales; nunca endpoints de gestión en Expo |

Las capturas ordinarias e importaciones usan el mismo servicio transaccional. La captura ponderada permite configurar pesos con cada lote y conserva el detalle exacto utilizado; no guarda ni altera automáticamente notas de otros alumnos o parciales.

## Casos de revisión cubiertos

- Una entrega antigua 85.33/100 se muestra como 8.533/10. Editar solo su retroalimentación conserva 85.33/100; una corrección explícita admite hasta seis decimales en el régimen nuevo. Las entregas del régimen histórico mantienen captura a dos decimales.
- El acta Final y su Excel usan únicamente Finales aprobadas o capturadas manualmente. Un promedio completo sin aprobación permanece pendiente.
- Los nuevos comprimidos académicos usan `expediente-egreso-iua/v2`: valores y escalas originales, régimen por clase, revisiones con autor y escalas e instantáneas de criterios. Los archivos v1 ya archivados se conservan sin sobrescribirlos. Ninguno sustituye SQL completo ni un backup restaurado.

- El cierre parcial admite alumnos con Final manual sustituta aunque no tengan parciales. El resto sí requiere la nota del parcial; el cierre Final exige que todos tengan una Final aprobada o capturada. No se crean notas ficticias.

## Aprobación explícita de Final — corrección confirmada el 28/oct/2026

El sistema propone el promedio exacto de P1–P4 (25 % cada uno). El profesor puede aprobarlo o capturar una nota manual 0–10. Administración de su plantel y SUPERADMIN también pueden aprobar/corregir; FINANZAS y ALUMNO no. Guardar una Final manual es una decisión explícita y no necesita cuatro parciales previos. Las Finales ya registradas se conservan.

- GET `/calificaciones/final/propuestas/:grupoMateriaId`: alumnos con inscripción vigente, propuesta, definitiva separada y revisión opaca. Validación por docente/plantel en servidor.
- POST `/calificaciones/final/aprobar`: `grupoMateriaId`, `alumnoId`, `revision` y motivo al sustituir. El cliente no envía una nota para aprobar. El servidor vuelve a calcular bajo los mismos bloqueos ciclo/clase usados por la captura; una revisión desactualizada da 409.
- La aprobación escribe `parcial=0`, autor e historial con `detalleCalculo.tipo=APROBACION_FINAL`, parciales originales/escala y pesos. Una corrección manual posterior conserva esa evidencia y exige motivo. Cambiar parciales actualiza la propuesta, sin sobrescribir una Final ya decidida.
- La propuesta no alimenta resultados oficiales, analítica, boleta ni acta como si fuera definitiva. Cerrar Final y ciclo exige Final registrada para todos los alumnos y su cierre autorizado. La aprobación no cierra automáticamente el periodo.
- Migración incremental adicional `migracion_aprobacion_final_precision.sql` en ambos motores: amplía notas oficiales e historial de DECIMAL(9,6) a DECIMAL(11,8). Sin backfill ni redondeo de valores existentes. Parciales siguen limitados a seis decimales; Final nueva, a ocho. Desplegar API/web/app coordinadas después de las migraciones pendientes del manifiesto.

Redondeo automático continúa desactivado: esta corrección define aprobación, no resuelve los ejemplos contradictorios. Los formatos continúan informativos y UAT de la candidata sigue pendiente; no se atribuye aceptación institucional a pruebas automatizadas.

Seguimiento de decisiones y aceptación aún pendientes: [#210](https://github.com/Marcor360/Sistema-Escolar/issues/210). El cierre de #139 corresponde a implementación candidata en #209, sin afirmar merge ni despliegue.
