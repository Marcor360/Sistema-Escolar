-- Rol institucional aditivo; no modifica permisos ni cuentas existentes.
INSERT INTO roles (clave, nombre)
SELECT N'DIRECTOR', N'Director'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE clave = N'DIRECTOR');
GO
