CREATE TABLE IF NOT EXISTS planteles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clave VARCHAR(80) NOT NULL UNIQUE,
  nombre VARCHAR(150) NOT NULL,
  direccion VARCHAR(200) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

INSERT INTO planteles (clave, nombre)
SELECT 'GENERAL', 'Plantel General'
WHERE NOT EXISTS (SELECT 1 FROM planteles WHERE clave = 'GENERAL');

CREATE TABLE IF NOT EXISTS usuario_planteles (
  usuario_id INT NOT NULL,
  plantel_id INT NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (usuario_id, plantel_id),
  CONSTRAINT fk_up_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_up_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

SET @plantel_general := (SELECT id FROM planteles WHERE clave = 'GENERAL' LIMIT 1);

ALTER TABLE alumnos ADD COLUMN plantel_id INT NULL;
UPDATE alumnos SET plantel_id = @plantel_general WHERE plantel_id IS NULL;
ALTER TABLE alumnos MODIFY plantel_id INT NOT NULL;
ALTER TABLE alumnos ADD CONSTRAINT fk_al_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id);
CREATE INDEX idx_alumnos_plantel ON alumnos(plantel_id);

ALTER TABLE grupos ADD COLUMN plantel_id INT NULL;
UPDATE grupos SET plantel_id = @plantel_general WHERE plantel_id IS NULL;
ALTER TABLE grupos MODIFY plantel_id INT NOT NULL;
ALTER TABLE grupos ADD CONSTRAINT fk_gr_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id);
CREATE INDEX idx_grupos_plantel ON grupos(plantel_id);

ALTER TABLE eventos_calendario ADD COLUMN plantel_id INT NULL;
ALTER TABLE eventos_calendario ADD CONSTRAINT fk_ev_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id) ON DELETE SET NULL;
CREATE INDEX idx_eventos_plantel ON eventos_calendario(plantel_id);
CREATE INDEX idx_eventos_fecha_inicio ON eventos_calendario(fecha_inicio);
CREATE INDEX idx_usuario_planteles_usuario ON usuario_planteles(usuario_id);
CREATE INDEX idx_inscripciones_alumno ON inscripciones(alumno_id);
