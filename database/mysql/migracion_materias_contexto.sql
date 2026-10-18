-- Sin clasificar ni duplicar materias históricas.
ALTER TABLE materias ADD tipo VARCHAR(16) NULL;
ALTER TABLE materias ADD CONSTRAINT ck_materia_tipo CHECK (tipo IS NULL OR tipo IN ('OBLIGATORIA','OPTATIVA','ADICIONAL','COMPLEMENTARIA'));
CREATE TABLE materia_contextos (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 materia_id INT NOT NULL,
 periodo_academico_id INT NOT NULL,
 activo BOOLEAN NOT NULL DEFAULT 1,
 CONSTRAINT uq_materia_periodo UNIQUE (materia_id,periodo_academico_id),
 CONSTRAINT fk_materia_contexto_materia FOREIGN KEY (materia_id) REFERENCES materias(id),
 CONSTRAINT fk_materia_contexto_periodo FOREIGN KEY (periodo_academico_id) REFERENCES periodos_academicos(id)
);
