-- Conserva números originales, historiales y ciclos cerrados. No recalcula notas.
ALTER TABLE grupo_materias ADD regimen_evaluacion VARCHAR(30) NOT NULL DEFAULT 'CUATRO_PARCIALES_10';
UPDATE grupo_materias gm JOIN grupos g ON g.id=gm.grupo_id JOIN ciclos_escolares c ON c.id=g.ciclo_id
SET gm.regimen_evaluacion='LEGADO_100' WHERE c.estado = 'CERRADO';
ALTER TABLE calificaciones ADD escala_maxima INT NOT NULL DEFAULT 100;
ALTER TABLE calificaciones MODIFY calificacion DECIMAL(9,6) NOT NULL;
ALTER TABLE historial_calificaciones ADD escala_anterior INT NOT NULL DEFAULT 100, ADD escala_nueva INT NOT NULL DEFAULT 100, ADD detalle_calculo TEXT NULL;
ALTER TABLE historial_calificaciones MODIFY valor_anterior DECIMAL(9,6) NULL, MODIFY valor_nuevo DECIMAL(9,6) NOT NULL;
