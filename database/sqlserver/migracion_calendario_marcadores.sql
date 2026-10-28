-- Aditiva: eventos anteriores conservan marcador NULL; no se crean fechas ni eventos.
CREATE TABLE calendario_marcadores (
 id INT IDENTITY(1,1) PRIMARY KEY,
 plantel_id INT NOT NULL,
 clave NVARCHAR(50) NOT NULL,
 nombre NVARCHAR(150) NOT NULL,
 color NVARCHAR(7) NOT NULL,
 forma NVARCHAR(15) NOT NULL,
 revision INT NOT NULL DEFAULT 1,
 CONSTRAINT fk_calendario_marcador_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT uq_calendario_marcador_plantel UNIQUE (plantel_id, clave)
);
ALTER TABLE eventos_calendario ADD marcador_clave NVARCHAR(50) NULL;
