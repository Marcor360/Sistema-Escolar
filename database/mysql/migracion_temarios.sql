-- Dominio independiente: no genera actividades, inscripciones ni calificaciones.
CREATE TABLE temas (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 grupo_materia_id INT NOT NULL,
 indice INT NOT NULL,
 titulo VARCHAR(150) NOT NULL,
 contenido TEXT NOT NULL,
 estado VARCHAR(12) NOT NULL DEFAULT 'BORRADOR',
 desde DATETIME NULL,
 hasta DATETIME NULL,
 parcial INT NULL,
 enlace VARCHAR(1000) NULL,
 revision INT NOT NULL DEFAULT 1,
 creador_id INT NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT uq_tema_clase_indice UNIQUE (grupo_materia_id, indice),
 CONSTRAINT ck_tema_estado CHECK (estado IN ('BORRADOR','PUBLICADO','CANCELADO')),
 CONSTRAINT ck_tema_numeros CHECK (indice BETWEEN 1 AND 10000 AND revision >= 1 AND (parcial IS NULL OR parcial BETWEEN 1 AND 3)),
 CONSTRAINT ck_tema_fechas CHECK (desde IS NULL OR hasta IS NULL OR hasta >= desde),
 CONSTRAINT fk_tema_clase FOREIGN KEY (grupo_materia_id) REFERENCES grupo_materias(id),
 CONSTRAINT fk_tema_creador FOREIGN KEY (creador_id) REFERENCES usuarios(id)
);
CREATE INDEX idx_tema_publicacion ON temas(grupo_materia_id, estado, desde);
CREATE TABLE tema_adjuntos (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 tema_id INT NOT NULL,
 archivo_nombre VARCHAR(200) NOT NULL,
 archivo_ruta VARCHAR(300) NOT NULL,
 mime VARCHAR(100) NOT NULL,
 tamano_kb INT NOT NULL,
 activo BOOLEAN NOT NULL DEFAULT 1,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_tema_adjunto FOREIGN KEY (tema_id) REFERENCES temas(id)
);
CREATE INDEX idx_tema_adjunto ON tema_adjuntos(tema_id, activo);

CREATE TABLE tema_revisiones (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 tema_id INT NOT NULL,
 revision INT NOT NULL,
 usuario_id INT NOT NULL,
 accion VARCHAR(40) NOT NULL,
 detalle TEXT NOT NULL,
 fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT uq_tema_revision UNIQUE (tema_id,revision),
 CONSTRAINT fk_revision_tema FOREIGN KEY (tema_id) REFERENCES temas(id),
 CONSTRAINT fk_revision_tema_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
