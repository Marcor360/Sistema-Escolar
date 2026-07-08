-- Datos de catálogo para SQL Server. Usuarios demo: `npm run seed` en el backend.
USE escolar;
GO

INSERT INTO roles (clave, nombre) VALUES
  ('ALUMNO', 'Alumno'),
  ('MAESTRO', 'Maestro'),
  ('ADMINISTRATIVO', 'Administrativo'),
  ('FINANZAS', 'Finanzas'),
  ('SUPERADMIN', 'Superadministrador');

INSERT INTO conceptos_pago (clave, nombre, tipo, monto_base) VALUES
  ('INS',  'Inscripción',         'INSCRIPCION', 3500.00),
  ('COL',  'Colegiatura mensual', 'COLEGIATURA', 2800.00),
  ('REC',  'Recargo por mora',    'RECARGO',        0.00),
  ('DESC', 'Descuento',           'DESCUENTO',      0.00),
  ('BECA', 'Beca',                'BECA',           0.00);

INSERT INTO plantillas_correo (clave, asunto, cuerpo_html) VALUES
  ('AVISO_ADEUDO', N'Aviso de adeudo — {{institucion}}',
   N'<p>Estimado(a) {{nombre}}:</p><p>Le recordamos que presenta un saldo pendiente de <b>${{saldo}} MXN</b>. Puede realizar su pago en línea o en ventanilla.</p><p>Si ya realizó su pago, haga caso omiso de este aviso.</p><p>{{institucion}}</p>');
GO
