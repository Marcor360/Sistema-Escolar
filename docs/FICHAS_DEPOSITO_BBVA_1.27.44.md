# Fichas PDF BBVA por cargo existente · versión 1.27.44

## Operación incorporada
- Configuración de cuenta de depósito BBVA (titular, 10 dígitos y CLABE opcional validada) limitada a SUPERADMIN, con migración aditiva MySQL/SQL Server. No se precargan números, ni se guardan secretos bancarios.
- Cada cargo existente tiene identificador `IUA-C##########`, unívoco y derivado del ID del cargo; no es una referencia bancaria homologada. GET /api/finanzas/fichas/:id valida rol y plantel; alumno consulta únicamente fichas de sus propios cargos.
- GET /api/finanzas/fichas/:id/pdf produce PDF privado (sin caché) con nombre de institución, monograma o logo PNG/JPEG si existe, datos del alumno y plantel, concepto (incluido número de parcialidad cuando figure en la descripción del cargo), estado, saldo, identificador, titular y cuenta BBVA.
- POST /api/finanzas/fichas/registrar exige FINANZAS, referencia externa/folio, monto, UUID de idempotencia y confirmación expresa de que se cotejó el comprobante. Reutiliza PagosService.registrarManual, la bitácora, el saldo y el bloqueo de cargos con Openpay pendiente. No crea nuevo ledger.
- En Expo, estado de cuenta muestra solo cargos con saldo positivo y oculta el historial de pagos. La API para el portal escolar sigue conservando cargos pagados y movimientos.

## Límites de implementación (sin fingir integración)
- **No hay conexión a BBVA** ni autorización para consumir sus movimientos o webhooks. El identificador no produce acreditación bancaria automática: FINANZAS debe verificar movimientos y dar conformidad. El pago se marca PAGADO solo cuando la API liquida su saldo, o PARCIAL si resta pendiente.
- **Logo raster WebP:** a partir del PR 1.27.46 se genera al subir un logo una variante PNG de 768 px con el mismo identificador; el servidor la valida y la ficha la incrusta, con fallback a monograma si no está. Logos ya cargados antes de 1.27.46 requieren que SUPERADMIN los vuelva a subir. Tampoco existe en el repositorio archivo oficial del logotipo BBVA: se incluye el nombre BBVA en texto, no un logo falsificado.
- La migración no emite fichas ni cambia cargos automáticamente. La programación previa 1.27.43 todavía es una previsualización, no un plan persistido y no genera cuotas. Las restricciones existentes impiden otra apertura por alumno+ciclo. Resolver esto en fase transaccional específica, no con escrituras destructivas.
- Evitar autorizar producción hasta probar ambos motores, permiso multi-plantel, devolución/anulación, verificación de folios concurrentes y la representación del logo real.

## UAT mínimo
1. SUPERADMIN configura BBVA. ALUMNO/FINANZAS/ADMINISTRATIVO/MAESTRO no pueden editar; ningún usuario no autorizado puede leer la configuración institucional bancaria.
2. FINANZAS emite PDF de un cargo propio con cuenta autorizada, y la UI bloquea la ficha si no hay banco activo. Comprobar alumno/plantel correctos.
3. Cambiar ID para intentar ver datos de otro alumno/plantel: API debe devolver 403.
4. Pago parcial y total: registrar solo tras validación externa, sin exceder saldo; reintentar mismo UUID y bloquear referencia diferente.
5. Fichas PDF en impresora A4; revisar caso de WebP y activo BBVA antes de certificar.
