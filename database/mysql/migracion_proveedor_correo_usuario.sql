-- Preferencia institucional de remitente; sin modificar emails ni buzones.
ALTER TABLE usuarios ADD COLUMN correo_proveedor VARCHAR(20) NOT NULL DEFAULT 'GODADDY';

-- Las cuentas de alumno existentes usan Microsoft 365 salvo corrección explícita posterior.
UPDATE usuarios AS u SET u.correo_proveedor = 'MICROSOFT365'
WHERE EXISTS (
  SELECT 1 FROM usuario_roles AS ur INNER JOIN roles AS r ON r.id = ur.rol_id
  WHERE ur.usuario_id = u.id AND r.clave = 'ALUMNO'
);
