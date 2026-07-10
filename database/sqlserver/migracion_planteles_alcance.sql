IF OBJECT_ID('planteles', 'U') IS NULL
BEGIN
  CREATE TABLE planteles (
    id INT IDENTITY(1,1) PRIMARY KEY,
    clave NVARCHAR(80) NOT NULL UNIQUE,
    nombre NVARCHAR(150) NOT NULL,
    direccion NVARCHAR(200) NULL,
    activo BIT NOT NULL DEFAULT 1
  );
END;

IF NOT EXISTS (SELECT 1 FROM planteles WHERE clave = 'GENERAL')
  INSERT INTO planteles (clave, nombre) VALUES ('GENERAL', 'Plantel General');

IF OBJECT_ID('usuario_planteles', 'U') IS NULL
BEGIN
  CREATE TABLE usuario_planteles (
    usuario_id INT NOT NULL,
    plantel_id INT NOT NULL,
    activo BIT NOT NULL DEFAULT 1,
    PRIMARY KEY (usuario_id, plantel_id),
    CONSTRAINT fk_up_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_up_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id) ON DELETE CASCADE
  );
END;

DECLARE @plantel_general INT = (SELECT TOP 1 id FROM planteles WHERE clave = 'GENERAL');

IF COL_LENGTH('alumnos', 'plantel_id') IS NULL
BEGIN
  ALTER TABLE alumnos ADD plantel_id INT NULL;
  UPDATE alumnos SET plantel_id = @plantel_general WHERE plantel_id IS NULL;
  ALTER TABLE alumnos ALTER COLUMN plantel_id INT NOT NULL;
  ALTER TABLE alumnos ADD CONSTRAINT fk_al_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id);
END;

IF COL_LENGTH('grupos', 'plantel_id') IS NULL
BEGIN
  ALTER TABLE grupos ADD plantel_id INT NULL;
  UPDATE grupos SET plantel_id = @plantel_general WHERE plantel_id IS NULL;
  ALTER TABLE grupos ALTER COLUMN plantel_id INT NOT NULL;
  ALTER TABLE grupos ADD CONSTRAINT fk_gr_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id);
END;

IF COL_LENGTH('eventos_calendario', 'plantel_id') IS NULL
BEGIN
  ALTER TABLE eventos_calendario ADD plantel_id INT NULL;
  ALTER TABLE eventos_calendario ADD CONSTRAINT fk_ev_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id) ON DELETE SET NULL;
END;
