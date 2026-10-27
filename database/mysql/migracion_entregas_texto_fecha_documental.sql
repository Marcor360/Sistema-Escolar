-- Aditiva: conserva entregas, adjuntos, comentarios y calificaciones existentes.
ALTER TABLE entregas ADD respuesta_texto VARCHAR(3000) NULL;

-- Legados: fecha civil documentada, sin backfill ni fechas inferidas.
ALTER TABLE egresos_alumnos ADD fecha_documental DATE NULL;
