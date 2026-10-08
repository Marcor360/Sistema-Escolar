-- 1.18.0: previews compartidos, cifrados y consumidos transaccionalmente.
CREATE TABLE importacion_previews (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 actor_id INT NOT NULL,
 tipo VARCHAR(15) NOT NULL,
 expira DATETIME NOT NULL,
 CONSTRAINT fk_importacion_preview_actor FOREIGN KEY (actor_id) REFERENCES usuarios(id)
);
GO
CREATE INDEX idx_importacion_actor_expira ON importacion_previews(actor_id,expira);
GO
CREATE TABLE importacion_filas (
 id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
 preview_id VARCHAR(36) NOT NULL,
 posicion INT NOT NULL,
 contenido VARCHAR(8000) NOT NULL,
 CONSTRAINT fk_importacion_fila_preview FOREIGN KEY (preview_id) REFERENCES importacion_previews(id) ON DELETE CASCADE
);
GO
CREATE UNIQUE INDEX uq_importacion_fila ON importacion_filas(preview_id,posicion);
GO
