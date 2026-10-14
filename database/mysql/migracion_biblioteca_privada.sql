-- Biblioteca privada: migración aditiva, sin alterar ni recrear datos existentes.
CREATE TABLE biblioteca_carpetas (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 plantel_id INT NOT NULL,
 padre_id INT NULL,
 nombre VARCHAR(120) NOT NULL,
 CONSTRAINT fk_biblioteca_carpeta_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT fk_biblioteca_carpeta_padre FOREIGN KEY (padre_id) REFERENCES biblioteca_carpetas(id)
);
CREATE INDEX idx_biblioteca_carpeta_plantel ON biblioteca_carpetas(plantel_id,padre_id);
CREATE TABLE biblioteca_archivos (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 plantel_id INT NOT NULL,
 carpeta_id INT NOT NULL,
 titulo VARCHAR(150) NOT NULL,
 archivo_nombre VARCHAR(200) NOT NULL,
 archivo_ruta VARCHAR(200) NOT NULL,
 mime VARCHAR(100) NOT NULL,
 bytes INT NOT NULL,
 categoria VARCHAR(20) NOT NULL,
 creado_por_id INT NOT NULL,
 creado_at DATETIME NOT NULL,
 CONSTRAINT fk_biblioteca_archivo_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT fk_biblioteca_archivo_carpeta FOREIGN KEY (carpeta_id) REFERENCES biblioteca_carpetas(id),
 CONSTRAINT ck_biblioteca_bytes CHECK (bytes > 0 AND bytes <= 10485760),
 CONSTRAINT ck_biblioteca_categoria CHECK (categoria IN ('FOTO','LOGO','CALENDARIO','DOCUMENTO'))
);
CREATE INDEX idx_biblioteca_archivo_plantel ON biblioteca_archivos(plantel_id,carpeta_id);
