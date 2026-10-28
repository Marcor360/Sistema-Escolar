-- Aditiva: eventos anteriores conservan marcador NULL; no se crean fechas ni eventos.
CREATE TABLE calendario_marcadores (
 id INT AUTO_INCREMENT PRIMARY KEY,
 plantel_id INT NOT NULL,
 clave VARCHAR(50) NOT NULL,
 nombre VARCHAR(150) NOT NULL,
 color VARCHAR(7) NOT NULL,
 forma VARCHAR(15) NOT NULL,
 revision INT NOT NULL DEFAULT 1,
 CONSTRAINT fk_calendario_marcador_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT uq_calendario_marcador_plantel UNIQUE (plantel_id, clave)
);
ALTER TABLE eventos_calendario ADD marcador_clave VARCHAR(50) NULL;
