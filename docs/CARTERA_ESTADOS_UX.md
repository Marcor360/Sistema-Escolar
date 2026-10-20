# Apertura de cartera y agrupación — 1.27.4

La API conserva cotización firmada, idempotencia y planificación ordinaria existente. Este PR ajusta presentación, no tarifas, topes, grupos ni transacciones.

## Estados observables
- ABIERTA: alumno asignado e inscripción/cargos confirmados.
- PENDIENTE: solicitud con valores cotizados, sin cargos nuevos mientras no se asigne grupo.
- REQUIERE_REVISION: solicitud anulada; requiere intervención de Control Escolar.

La vista presenta nombre/matrícula únicamente a usuarios que ya pueden consultar cartera en su plantel, además de total cotizado y cargos confirmados. En móvil web la tabla pasa a fichas semánticas; en formulario se explica planificación automática y diferencia entre periodo de cobro y ciclo. Las reglas 1–4 pendiente, desde 5 grupo y excepción hasta 54 provienen de la implementación de agrupación vigente; no son nuevos requisitos.

## Puertas UAT
Probar con solicitudes del mismo contexto homogéneo, 1–4, 5, 50, 51–54 y 55, capacidad saturada, plantel ajeno, solicitud anulada, cargo existente, doble confirmación e idempotencia; confirmar no duplicidad contable. No se dispone de resultados institucionales; estado pendiente.
