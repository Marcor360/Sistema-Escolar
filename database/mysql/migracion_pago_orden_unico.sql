-- Evita registrar más de un pago de pasarela por orden cuando Openpay reintenta webhooks.
-- En MySQL un índice UNIQUE permite múltiples NULL para los pagos manuales.
-- Antes de aplicar, resolver cualquier duplicado existente con conciliación financiera:
-- SELECT orden_pago_id, COUNT(*) FROM pagos WHERE orden_pago_id IS NOT NULL
-- GROUP BY orden_pago_id HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX uq_pagos_orden_pago ON pagos (orden_pago_id);
