# Fichas PDF BBVA por cargo existente · versión 1.27.44

## Operación incorporada
- Configuración de cuenta de depósito BBVA (titular, 10 dígitos y CLABE opcional validada) limitada a SUPERADMIN, con migración aditiva MySQL/SQL Server. No se precargan números, ni se guardan secretos bancarios.
- Cada cargo existente tiene identificador `IUA-C##########`, unívoco y derivado del ID del cargo; no es una referencia bancaria homologada. GET /api/finanzas/fichas/:id valida rol y plantel; alumno consulta únicamente fichas de sus propios cargos.
- GET /api/finanzas/fichas/:id/pdf produce PDF privado (sin caché) con nombre de institución, monograma o logo PNG/JPEG si existe, datos del alumno y plantel, concepto (incluido número de parcialidad cuando figure en la descripción del cargo), estado, saldo, identificador, titular y cuenta BBVA.
- POST /api/finanzas/fichas/registrar exige FINANZAS, referencia externa/folio, monto, UUID de idempotencia y confirmación expresa de que se cotejó el comprobante. Reutiliza PagosService.registrarManual, la bitácora, el saldo y el bloqueo de cargos con Openpay pendiente. No crea nuevo ledger.
- En Expo, estado de cuenta muestra solo cargos con saldo positivo y oculta el historial de pagos. La API para el portal escolar sigue conservando cargos pagados y movimientos.

## Límites de implementación (sin fingir integración)
- **No hay conexión a BBVA** ni autorización para consumir sus movimientos o webhooks. El identificador no produce acreditación bancaria automática: FINANZAS debe verificar movimientos y dar conformidad. El pago se marca PAGADO solo cuando la API liquida su saldo, o PARCIAL si resta pendiente.
- **Logo raster WebP pendiente**: el portal institucional actual guarda logos como WebP y PDFKit 0.15 solo incrusta PNG/JPEG. Para esas marcas se imprimirá monograma, no la imagen del logo. Se necesitará conservar un derivado PNG autorizado o implementar un conversor probado. Tampoco existe en el repositorio archivo oficial del logotipo BBVA: se incluye el nombre BBVA en texto, no un logo falsificado.
- La migración no emite fichas ni cambia cargos automáticamente. La programación previa 1.27.43 todavía es una previsualización, no un plan persistido y no genera cuotas. Las restricciones existentes impiden otra apertura por alumno+ciclo. Resolver esto en fase transaccional específica, no con escrituras destructivas.
- Evitar autorizar producción hasta probar ambos motores, permiso multi-plantel, devolución/anulación, verificación de folios concurrentes y la representación del logo real.

## UAT mínimo
1. SUPERADMIN configura BBVA. ALUMNO/FINANZAS/ADMINISTRATIVO/MAESTRO no pueden editar; ningún usuario no autorizado puede leer la configuración institucional bancaria.
2. FINANZAS emite PDF de un cargo propio con cuenta autorizada, y la UI bloquea la ficha si no hay banco activo. Comprobar alumno/plantel correctos.
3. Cambiar ID para intentar ver datos de otro alumno/plantel: API debe devolver 403.
4. Pago parcial y total: registrar solo tras validación externa, sin exceder saldo; reintentar mismo UUID y bloquear referencia diferente.
5. Fichas PDF en impresora A4; revisar caso de WebP y activo BBVA antes de certificar.

## Correcciones de revisión

- El plantel impreso es el origen histórico del cargo, aunque el alumno se traslade.
- La comprobación de folio de la ruta de fichas se realiza dentro de la transacción de pago, con un bloqueo compartido de la cuenta BBVA antes de bloquear el cargo. Esto serializa registros por fichas en ambos motores; exige configurar la cuenta previamente y conserva reintentos con la misma clave. No cambia la política de folios del endpoint general de pagos manuales.
- Cambiar cargo, monto, método o folio en web exige volver a confirmar el cotejo.
- Pruebas nuevas: aislamiento de alumno, origen histórico, generación PDF y reintentos/folios confirmados mientras se espera el bloqueo.
