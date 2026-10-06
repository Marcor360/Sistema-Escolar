-- Evita duplicar pagos manuales cuando el cliente reintenta tras un timeout.
-- Los pagos históricos permanecen en NULL; el índice filtrado permite múltiples NULL.
ALTER TABLE pagos ADD clave_idempotencia NVARCHAR(36) NULL;
GO

CREATE UNIQUE INDEX uq_pagos_clave_idempotencia ON pagos(clave_idempotencia)
  WHERE clave_idempotencia IS NOT NULL;
GO
