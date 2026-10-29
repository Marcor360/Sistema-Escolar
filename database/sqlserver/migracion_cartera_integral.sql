-- Incremental. El índice rechaza duplicados, sin borrar ni fusionar datos.
CREATE UNIQUE INDEX uq_alumno_curp ON alumnos(curp) WHERE curp IS NOT NULL;
GO
-- Sustituir solamente la unicidad del correo por índice filtrado: admite múltiples
-- expedientes sin correo y conserva la exclusividad de direcciones institucionales.
DECLARE @constraint SYSNAME;
SELECT @constraint=kc.name FROM sys.key_constraints kc
JOIN sys.index_columns ic ON ic.object_id=kc.parent_object_id AND ic.index_id=kc.unique_index_id
JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
WHERE kc.parent_object_id=OBJECT_ID('usuarios') AND kc.type='UQ' AND c.name='email';
IF @constraint IS NOT NULL
BEGIN
  DECLARE @sql NVARCHAR(MAX)='ALTER TABLE usuarios DROP CONSTRAINT '+QUOTENAME(@constraint);
  EXEC(@sql);
END;
ALTER TABLE usuarios ALTER COLUMN email NVARCHAR(120) NULL;
CREATE UNIQUE INDEX uq_usuario_email ON usuarios(email) WHERE email IS NOT NULL;
GO
ALTER TABLE aperturas_cartera ADD contexto_json NVARCHAR(MAX) NULL;
ALTER TABLE aperturas_cartera DROP CONSTRAINT ck_apertura_estado;
ALTER TABLE aperturas_cartera ADD CONSTRAINT ck_apertura_estado CHECK (estado IN ('PENDIENTE','ABIERTA','PAUSA'));
ALTER TABLE solicitudes_grupo_regular DROP CONSTRAINT ck_solicitud_estado;
ALTER TABLE solicitudes_grupo_regular ADD CONSTRAINT ck_solicitud_estado CHECK (estado IN ('PENDIENTE','ASIGNADA','ANULADA','PAUSA'));
