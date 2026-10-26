---
name: iua-finanzas-escolares
description: Auditar reglas y UX de cartera, colegiaturas, becas, pagos, cobranza y reinscripción de IUA evitando cobros duplicados.
---
# Dominio financiero y reinscripciones

## Lecturas obligadas
Consultar `docs/FINANZAS_REQUERIMIENTOS_2026-10-22.md`, `docs/REINSCRIPCION_PERIODOS_Y_CARGOS_CONTRATO.md`, `docs/MATRIZ_ACCESO.md`, `backend/src/finanzas` y `backend/src/cartera`. Confirmar implementación real, no asumir que el contrato propuesto está terminado.

## Lista de verificación
1. Secundaria: total anual; bachillerato: total semestral; superior: total cuatrimestral con calendario configurable. El plan/carrera define periodos efectivos. No generar mensualidades fuera del total ni convertir automáticamente una propuesta en regla activa.
2. Becas y descuentos aplicados una sola vez con autorización de FINANZAS, auditables y compatibles con pagos parciales.
3. Verificar aislamiento por plantel, origen histórico de cargos, consulta propia de ALUMNO, estados PENDIENTE/PARCIAL/PAGADO y anulación sin alterar saldos.
4. Webhooks de Openpay idempotentes y reconciliados; nunca cobrar ni disparar proveedores reales en una auditoría.
5. Recordatorio del día 3 y recargo del 10% desde día 4 siguen sujetos a fecha real de vencimiento y habilitación explícita. No asumir recargo el día 4 si el cargo vence el día 5. Confirmar zona `America/Mexico_City`.
6. Reinscripción automática y cuentas por pagar: discriminar contratos diseñados de módulos que realmente existen; no ajustar unicidades ni cobrar nuevos periodos sin migraciones aprobadas.

## Evidencia
Describir cálculo con ejemplos ficticios, transacciones, permisos, pruebas de duplicidad, pendientes de regulación y qué debe validar Control Escolar/FINANZAS. Sin ejecutar cargos ni enviar avisos reales.
