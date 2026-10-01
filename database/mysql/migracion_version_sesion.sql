-- Incrementa version para invalidar JWT emitidos antes de un cambio de contraseña.
ALTER TABLE usuarios ADD COLUMN session_version INT NOT NULL DEFAULT 0;
