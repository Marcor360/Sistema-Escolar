-- Grupos existentes REGULAR; programas manuales sin nuevos alumnos, cargos ni cuentas.
CREATE TABLE programas_especiales (
 id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
 plantel_id INT NOT NULL,
 ciclo_id INT NOT NULL,
 clave NVARCHAR(20) NOT NULL,
 nombre NVARCHAR(120) NOT NULL,
 tipo NVARCHAR(24) NOT NULL,
 fecha_inicio DATE NOT NULL,
 fecha_fin DATE NOT NULL,
 estado NVARCHAR(16) NOT NULL DEFAULT 'ACTIVO',
 CONSTRAINT uq_programa_plantel_ciclo_clave UNIQUE (plantel_id,ciclo_id,clave),
 CONSTRAINT fk_programa_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT fk_programa_ciclo FOREIGN KEY (ciclo_id) REFERENCES ciclos_escolares(id),
 CONSTRAINT ck_programa_tipo CHECK (tipo IN ('DIPLOMADO','CERTIFICACION','ESPECIALIZACION','EXTRACURRICULAR')),
 CONSTRAINT ck_programa_estado CHECK (estado IN ('ACTIVO','CERRADO','CANCELADO')),
 CONSTRAINT ck_programa_fechas CHECK (fecha_inicio <= fecha_fin)
);
GO
ALTER TABLE grupos ADD tipo NVARCHAR(12) NOT NULL CONSTRAINT df_grupo_tipo DEFAULT 'REGULAR', programa_especial_id INT NULL, cupo_manual INT NULL;
GO
ALTER TABLE grupos ADD CONSTRAINT fk_grupo_programa FOREIGN KEY (programa_especial_id) REFERENCES programas_especiales(id);
GO
ALTER TABLE grupos ADD CONSTRAINT ck_grupo_modalidad CHECK ((tipo = 'REGULAR' AND programa_especial_id IS NULL AND cupo_manual IS NULL) OR (tipo = 'ESPECIAL' AND programa_especial_id IS NOT NULL AND cupo_manual IS NOT NULL AND cupo_manual BETWEEN 1 AND 10000));
GO
CREATE INDEX idx_grupo_programa ON grupos(programa_especial_id,tipo);
GO
