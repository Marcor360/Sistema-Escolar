-- Aditiva: sin catálogo precargado; grupos históricos conservan contexto NULL.
CREATE TABLE niveles_academicos (
 id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
 plantel_id INT NOT NULL,
 clave NVARCHAR(20) NOT NULL,
 nombre NVARCHAR(120) NOT NULL,
 activo BIT NOT NULL DEFAULT 1,
  CONSTRAINT fk_niveles_academicos_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT uq_nivel_plantel_clave UNIQUE (plantel_id,clave)
);
GO
CREATE TABLE carreras_planes (
 id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
 plantel_id INT NOT NULL,
 clave NVARCHAR(20) NOT NULL,
 nombre NVARCHAR(120) NOT NULL,
 activo BIT NOT NULL DEFAULT 1,
 nivel_id INT NOT NULL,
 version_plan NVARCHAR(40) NOT NULL,
 CONSTRAINT fk_carrera_nivel FOREIGN KEY (nivel_id) REFERENCES niveles_academicos(id),
 CONSTRAINT fk_carreras_planes_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT uq_carrera_plan UNIQUE (plantel_id,nivel_id,clave,version_plan)
);
GO
CREATE TABLE periodos_academicos (
 id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
 plantel_id INT NOT NULL,
 clave NVARCHAR(20) NOT NULL,
 nombre NVARCHAR(120) NOT NULL,
 activo BIT NOT NULL DEFAULT 1,
 carrera_id INT NOT NULL,
 ciclo_id INT NOT NULL,
 tipo NVARCHAR(16) NOT NULL,
 numero INT NOT NULL,
 CONSTRAINT fk_periodo_carrera FOREIGN KEY (carrera_id) REFERENCES carreras_planes(id),
 CONSTRAINT fk_periodo_ciclo FOREIGN KEY (ciclo_id) REFERENCES ciclos_escolares(id),
 CONSTRAINT ck_periodo_tipo CHECK (tipo IN ('ANUAL','SEMESTRAL','CUATRIMESTRAL')),
 CONSTRAINT ck_periodo_numero CHECK (numero BETWEEN 1 AND 1000),
 CONSTRAINT fk_periodos_academicos_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT uq_periodo_carrera_ciclo_clave UNIQUE (carrera_id,ciclo_id,clave),
 CONSTRAINT uq_periodo_carrera_ciclo_numero UNIQUE (carrera_id,ciclo_id,tipo,numero)
);
GO
ALTER TABLE grupos ADD nivel_id INT NULL, carrera_id INT NULL, periodo_academico_id INT NULL;
GO
ALTER TABLE grupos ADD CONSTRAINT fk_grupos_nivel_id FOREIGN KEY (nivel_id) REFERENCES niveles_academicos(id);
GO
ALTER TABLE grupos ADD CONSTRAINT fk_grupos_carrera_id FOREIGN KEY (carrera_id) REFERENCES carreras_planes(id);
GO
ALTER TABLE grupos ADD CONSTRAINT fk_grupos_periodo_academico_id FOREIGN KEY (periodo_academico_id) REFERENCES periodos_academicos(id);
GO
ALTER TABLE grupos ADD CONSTRAINT ck_grupo_contexto_completo CHECK ((nivel_id IS NULL AND carrera_id IS NULL AND periodo_academico_id IS NULL) OR (nivel_id IS NOT NULL AND carrera_id IS NOT NULL AND periodo_academico_id IS NOT NULL));
GO
CREATE INDEX idx_grupos_contexto ON grupos(plantel_id,nivel_id,carrera_id,periodo_academico_id);
GO
