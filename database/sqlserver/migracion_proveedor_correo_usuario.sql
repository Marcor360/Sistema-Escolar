-- Preferencia institucional de remitente; sin modificar emails ni buzones.
ALTER TABLE usuarios ADD correo_proveedor NVARCHAR(20) NOT NULL
  CONSTRAINT df_usuarios_correo_proveedor DEFAULT 'GODADDY';
GO

-- Las cuentas de alumno existentes usan Microsoft 365 salvo corrección explícita posterior.
UPDATE u SET correo_proveedor = 'MICROSOFT365'
FROM usuarios AS u
WHERE EXISTS (
  SELECT 1 FROM usuario_roles AS ur INNER JOIN roles AS r ON r.id = ur.rol_id
  WHERE ur.usuario_id = u.id AND r.clave = 'ALUMNO'
);
GO
