-- Ampliación sin redondear valores existentes; compatible con instalaciones que ya aplicaron las escalas.
ALTER TABLE entregas ALTER COLUMN calificacion DECIMAL(9,6) NULL;
