-- Contacto alternativo del alumno. El correo de acceso permanece en usuarios.email.
ALTER TABLE usuarios ADD COLUMN correo_personal VARCHAR(120) NULL;
