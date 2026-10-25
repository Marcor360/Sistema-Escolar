# Apertura financiera por anualidad, semestres y cuatrimestres · 1.27.43

## Estado actual y restricción heredada

El módulo `cartera` hoy crea una apertura por alumno+ciclo y sus cargos se materializan cuando se confirma la asignación de grupo. La base impone `uq_apertura_alumno_ciclo` y `uq_solicitud_alumno_ciclo`. No se puede emitir automáticamente el segundo semestre ni otro cuatrimestre con una segunda apertura del mismo ciclo sin rediseñar el modelo de inscripción/solicitudes e historificarlo. No debe disfrazarse la reinscripción como BAJA.

## Alcance implementado en esta entrega

- Previsualización de calendario de importes desde Finanzas, exclusivamente para FINANZAS/SUPERADMIN: `POST /api/finanzas/programaciones/previsualizar` (sin persistencia).
- Secundaria: total anual con un pago; Bachillerato: total anual repartido en **dos semestres** separados seis meses, con importes ajustables que deben sumar exactamente el total; universidad/licenciatura/especialidad/maestría/doctorado: total del cuatrimestre dividido en **cuatro mensualidades**; concepto adicional: de una a doce cuotas. Mes y día de vencimiento son explícitos.
- Redondeo en enteros de centavos y total exacto. No se inventan precios, periodos reales, ni se da validez académica a un calendario informativo.
- No crea cargos, ni apertura, ni plan de pago persistido; no se cobran conceptos sin consentimiento ni autorización. El formulario no permite modificar `configuracion_marca`: las opciones globales siguen bajo `SUPERADMIN` en los cuatro endpoints de escritura, el menú y la ruta web. Se añadieron pruebas de regresión.

## Diseño posterior requerido para materializar y conciliar

1. **Vincular a contexto real**: alumno, plantel, ciclo, nivel, carrera/plan y `periodo_academico_id`. La modalidad no se derivará de texto ni de un dropdown sin validar. Definir cómo representar el año con dos semestres y el cuatrimestre conforme al catálogo académico.
2. **Plan versionado** por alumno/periodo, autorizador FINANZAS, hash de aprobación, montos congelados, descuentos, becas, fecha y estado; cuotas de cobro con unicidad `alumno + periodo_academico + concepto + número`. Probar reintentos/concurrencia antes de crear cargos; comprobar cargos `COL`/apertura ya existentes para evitar doble cobro.
3. **Acoplar a agrupación**: solo materializar cargos cuando exista matrícula/grupo válido; preservar solicitud pendiente y UAT con todos los ciclos. Mantener estados contables y pagos del módulo existente, sin un segundo libro mayor.
4. **Fichas**: una referencia única e inmutable por cargo, consulta scoped, datos bancarios configurados por SUPERADMIN, PDF privado, evidencia bancaria, aplicación de pago auditada e idempotente. Mostrar en Expo solo adeudos, en web estado e historial.
5. **BBVA**: una referencia de ficha no demuestra un depósito. No marcar como PAGADO por captura de referencia sin corroborar fondos. Conciliación automática bancaria requiere contrato/acceso a movimientos/webhook, firmas, cuentas receptoras y autorización. Nunca fingir que un depósito se reconoció automáticamente.

## Casos UAT

- 1000.01 MXN: 2 semestres de 600.00 y 400.01, o 4 cuotas de 250.01 / 250.00 / 250.00 / 250.00.
- Prueba de colisión con anualidad/colegiatura existente y migraciones espejo antes de habilitar materialización.
- Restricciones de acceso: ALUMNO, MAESTRO, ADMINISTRATIVO y FINANZAS no modifican marca/colores/logo institucionales; solo SUPERADMIN. FINANZAS puede previsualizar importes, no crear usuario SUPERADMIN.
