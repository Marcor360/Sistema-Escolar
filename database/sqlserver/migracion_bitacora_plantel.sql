-- Permite consultar la bitácora financiera según el alcance por plantel.
ALTER TABLE bitacora_financiera ADD plantel_id INT NULL;
CREATE INDEX idx_bitacora_financiera_plantel ON bitacora_financiera(plantel_id, created_at DESC);
