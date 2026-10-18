# Carga de datos bajo demanda en Finanzas

## Cambio de código en este PR
`web/src/pages/Finanzas.tsx` ahora consulta **solo la colección de la pestaña activa** al entrar y al cambiar de pestaña: cargos, pagos o adeudos. Los catálogos y planteles se solicitan una vez al montar la página, y la recarga posterior a cada operación actúa sobre el panel actual. El paginado existente permanece intacto.

## Motivo
Antes, `cargarDatos` hacía solicitudes simultáneas a `/finanzas/cargos`, `/finanzas/pagos` y `/finanzas/adeudos` aun cuando el usuario solamente consultaba una sección. Eso multiplica tráfico y dificulta aislar fallas.

## Comprobaciones pendientes antes de merge
- Tests web de cambios de pestaña: al entrar solo cargos, al pulsar Pagos solo pagos, al pulsar Adeudos solo adeudos; no repetir catálogos/planteles por pestaña.
- Pruebas de botones de registrar/anular pago, generar/cancelar cargos, conciliación y cobranza que recarguen la colección del panel actual.
- QA con red lenta: estados de carga, errores y respuesta tardía después de cambiar pestaña.
- `npm run lint`, `npm test`, `npm run build` desde `web/`; Playwright responsive `npm run test:responsive`.

## Alcance deliberadamente limitado
No cambia API, reglas financieras, idempotencia, cálculos, autorizaciones ni esquema. Si una operación requiere refrescar un panel distinto del activo, revisar ese caso al validar el flujo con usuarios. La paginación de diez registros sigue en API.
