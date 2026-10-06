-- Evita duplicar pagos manuales cuando el cliente reintenta tras un timeout.
-- Los pagos históricos permanecen en NULL. MySQL permite múltiples NULL en un índice único.
ALTER TABLE pagos
  ADD COLUMN clave_idempotencia VARCHAR(36) NULL,
  ADD UNIQUE KEY uq_pagos_clave_idempotencia (clave_idempotencia);
