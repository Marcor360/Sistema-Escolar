ALTER TABLE eventos_calendario ADD ciclo_id INT NULL, ADD nivel_id INT NULL, ADD audiencia VARCHAR(20) NOT NULL DEFAULT 'ACADEMICA', ADD imagen_nombre VARCHAR(100) NULL;
ALTER TABLE eventos_calendario ADD CONSTRAINT fk_evento_ciclo FOREIGN KEY (ciclo_id) REFERENCES ciclos_escolares(id);
ALTER TABLE eventos_calendario ADD CONSTRAINT fk_evento_nivel FOREIGN KEY (nivel_id) REFERENCES niveles_academicos(id);
CREATE INDEX idx_evento_ciclo_nivel ON eventos_calendario(ciclo_id,nivel_id);
