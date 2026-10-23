# Contrato pendiente de Cuentas por pagar · Finanzas IUA

**Versión preparatoria:** 1.27.24. **Estado:** diseño, NO implementado.

## Diferencia de dominios

- **Cuentas por cobrar:** obligaciones de ALUMNOS hacia la institución. Ya existen `cargos`, `pagos`, `cobranza_envios`. No alterarlos para almacenar facturas de proveedores.
- **Cuentas por pagar:** obligaciones de la **institución** hacia proveedores o prestadores. Actualmente **no existen** entidad, migración, controlador ni pantalla especializados. No confundir cuentas por cobrar y por pagar.
- Los gastos o egresos no se deducen automáticamente de los ingresos de colegiaturas. Sin contabilidad o banca conciliada, un reporte de saldos bancarios sería engañoso.

## Contrato funcional propuesto para la siguiente implementación

1. Alta por FINANZAS, con plantel autorizado, proveedor, concepto, importe positivo en MXN, fecha límite de pago, referencia documental opcional y responsable operativo. Folio único; estado inicial `PENDIENTE`.
2. Listado paginado (10 por defecto), filtros por plantel, estatus, fechas y proveedor; estado de carga/vacío/error; vista accesible y responsive; operación administrativa exclusivamente en web.
3. Confirmación explícita de pago **ya efectuado** con fecha, referencia y responsable; cambio de estado `PAGADO` solo con auditoría. No ejecutar transferencias, no guardar tarjetas o credenciales bancarias y no marcar pagado por enviar un recordatorio.
4. Recordatorio in-app para personal FINANZAS activo asignado al plantel en la fecha de vencimiento; notificaciones sin datos bancarios. Regla de una alerta por obligación y evento de vencimiento, clave persistente, transacción e idempotencia entre instancias. Reprogramar el evento cuando un usuario autorizado cambie la fecha.
5. Un job independiente de los avisos a deudores verifica vencimientos en zona `America/Mexico_City` y reintenta trabajos fallidos sin doble notificación. Debe definir estrategia para reinicio de API y vencimientos pasados.
6. Seguridad en todos los endpoints: JwtAuthGuard + RolesGuard, DTOs validados, `ScopeService` por plantel, bitácora sin datos personales ni secretos, límites a listados y protección contra consulta cruzada.
7. Migraciones incrementales de entidad nueva en `database/mysql/` y `database/sqlserver/`, registrar en `database/baseline-manifest.json` sin recrear bases ni activar `DB_SYNC`; pruebas de ambos motores con bases aisladas.

## Decisiones que debe confirmar Finanzas antes del despliegue

- ¿El recordatorio se genera solo el día de pago o también 1, 3 y 7 días antes?
- ¿Las obligaciones son únicas o también recurrentes (renta, servicios, nómina)? La recurrencia no debe duplicar folios.
- ¿Quién autoriza y quién confirma el pago? ¿Se requiere un flujo de doble aprobación?
- ¿Se permite pago parcial y reprogramación? ¿Cómo se documenta cancelación o devolución?
- ¿El aviso debe llegar solo a la campana web, por correo institucional o ambos? Para correo son obligatorias pruebas SMTP/Microsoft 365.
- ¿Qué información documental debe conservarse (factura CFDI, orden de compra, evidencia de transferencia)? Los adjuntos requieren almacenamiento privado y controles de acceso.

## Puertas de aceptación

- Aprobación de las reglas anteriores y matriz de roles por plantel.
- Flujo completo de creación, aviso, pago, historial y cancelación/reprogramación según reglas autorizadas.
- UAT en MySQL 8.4 y SQL Server 2022, con reinicios, concurrencia, errores de proveedor de correo, fechas límite, pruebas de permisos y accesibilidad.
- CI verde: lint, typecheck, tests, build y consistencia de versión; evidencia de migración/rollback en base aislada.

**No es una promesa de automatización activa:** el siguiente PR deberá implementar y probar el dominio. Este documento no genera cargos, egresos ni avisos.
