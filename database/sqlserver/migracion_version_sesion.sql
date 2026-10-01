-- Incrementa version para invalidar JWT emitidos antes de un cambio de contraseña.
ALTER TABLE usuarios ADD session_version INT NOT NULL CONSTRAINT df_usuarios_session_version DEFAULT 0;
