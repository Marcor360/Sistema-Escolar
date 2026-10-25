# Persistencia y emisión segura de planes de cobro · 1.27.50

## Funcionalidad nueva
1. Desde la previsualización financiera 1.27.43 se identifica explícitamente plantel, alumno ya inscrito, ciclo, nivel/carrera, periodo y concepto existente. La API valida todos los IDs contra el catálogo real y el alcance del rol FINANZAS; no infiere estudios por cadenas de texto.
2. `POST /api/finanzas/programaciones/confirmar` (FINANZAS/SUPERADMIN) guarda un plan inmutable (concepto/periodo/total/cuotas, hash, actor e idempotencia) sin generar pagos ni cargos. Retorna programación con importes, fechas y vínculos a cargos emitidos.
3. `POST /api/finanzas/programaciones/:id/cuotas/:numero/emitir` crea **un cargo por cuota**, bloquea la programación y el plantel, valida al alumno/inscripción regular en el periodo de esa cuota, ciclo ACTIVO y concepto activo, compara con cargos previos del mismo periodo para evitar dobles cobros, registra bitácora y conserva el cargoId en la cuota. Un reintento de emisión devuelve el mismo cargo.
4. Cada cargo emitido genera ficha PDF e identificador propios por el PR 1.27.44; los pagos son manejados por el sistema actual `PagosService`, sin segunda contabilidad. La app muestra los pendientes, el portal conserva el historial.
5. Migración aditiva espejo MySQL/SQL Server crea `programaciones_cobro`, sin relajar reglas académicas ni alterar pagos previos. Restricción de unicidad por alumno+ciclo+periodo+concepto e idempotencia UUID.

## Restricciones obligatorias (no se ocultan)
- La generación es **manual y por cuota**: primero se verifica el periodo académico y después FINANZAS emite. Un plan registrado no constituye adeudo aún; el adeudo aparece en `cargos` al emitir la cuota.
- Bachillerato requiere segundo semestre consecutivo del mismo plan **y ciclo**; solo podrá emitirse al existir inscripción regular activa en el segundo periodo. Si la institución utiliza un ciclo distinto para el segundo semestre, requiere desarrollo específico de programación inter-ciclo. No crear inscripciones ficticias ni cambiar alumnos a BAJA para eludir unicidad.
- No se cambian `uq_apertura_alumno_ciclo`, `uq_solicitud_alumno_ciclo` ni estados académicos. Las cuotas de una misma matrícula solo se emiten cuando su contexto de grupo es válido.
- Evitar duplicación con generación masiva `COL`: se bloquea emisión de cualquier segunda colegiatura del mismo mes y alumno/ciclo. Antes de activar en producción, ejecutar UAT de **concurrencia real** entre generación masiva `COL` y emisión de planes con dos operadores.
- El plan queda congelado; un error de importe requiere procedimiento financiero de anulación con motivo y revisión. La reversión o reemisión administrativa integral de planes históricos no existe todavía. No generar otro plan para el mismo periodo y concepto.
- La cuenta BBVA sigue requiriendo configuración por SUPERADMIN y revisión manual del comprobante; **no hay webhook BBVA**. El PDF sigue usando monograma cuando el logo es WebP, pendiente de solución de conversión segura a PNG/JPEG.
- No asignar tarifas no autorizadas, no aplicar recargos ni intereses retrospectivos; `aplicaRecargo` depende del concepto existente.

## UAT antes de uso institucional
- Confirmar 4 mensualidades del cuatrimestre; emitir solo una, comprobar un cargo y ficha, reintentar misma emisión sin duplicado, registrar parcial/total, verificar app/web.
- Bachillerato: dos semestres ajustados que suman el total; segundo bloqueado sin inscripción adecuada; ambos periodos consecutivos reales y vigencia del ciclo.
- Secundaria: una anualidad, sin cargos mensuales duplicados.
- Servicio adicional: titulación en pago único o parcialidades, montos positivos y suma exacta, con validación del concepto `OTRO`.
- Dos alumnos y dos planteles: consulta ajena 403. Probar copia de UUID y conflicto de clave. Ensayar MySQL/SQL Server, migración y restore aislado.

## Correcciones y cobertura de revisión

- Confirmación y emisión comparten el orden ciclo → alumno → plantel → programación con el generador masivo. La integración también compite entre dos ciclos del mismo alumno para detectar bloqueos cruzados.
- La idempotencia no depende del orden de campos JSON. Emitir vuelve a comprobar periodo activo y tipo de concepto compatible; un reintento ya emitido conserva su cargo incluso si después se cierra el ciclo.
- La interfaz permite consultar por número una programación persistida y emitir sus cuotas tras recargar.
- Integración con fixtures: confirmar/reintentar, emitir simultáneamente una cuota, competir con el generador COL sin cobro duplicado, denegar periodo inactivo, concepto alterado y otro plantel. La cola automática de cobranza se desactiva en el harness para que sus pruebas controlen el envío simulado.
