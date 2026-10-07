-- 1.16.0: origen financiero estable, outbox push y cobranza auditable.
ALTER TABLE cargos ADD plantel_id INT NULL;
ALTER TABLE ordenes_pago ADD plantel_id INT NULL;
ALTER TABLE pagos ADD plantel_id INT NULL;
UPDATE cargos c JOIN alumnos a ON a.id=c.alumno_id SET c.plantel_id=COALESCE((SELECT b.plantel_id FROM bitacora_financiera b WHERE b.entidad='cargo' AND b.entidad_id=c.id AND b.plantel_id IS NOT NULL AND b.accion IN ('CREAR_CARGO','GENERAR_COLEGIATURA') ORDER BY b.id LIMIT 1),a.plantel_id);
UPDATE ordenes_pago o JOIN alumnos a ON a.id=o.alumno_id LEFT JOIN cargos c ON c.id=o.cargo_id SET o.plantel_id=COALESCE(c.plantel_id,a.plantel_id);
UPDATE pagos p JOIN alumnos a ON a.id=p.alumno_id LEFT JOIN cargos c ON c.id=p.cargo_id LEFT JOIN ordenes_pago o ON o.id=p.orden_pago_id SET p.plantel_id=COALESCE(c.plantel_id,o.plantel_id,a.plantel_id);
ALTER TABLE cargos MODIFY plantel_id INT NOT NULL;
ALTER TABLE cargos ADD CONSTRAINT fk_cargos_plantel_origen FOREIGN KEY (plantel_id) REFERENCES planteles(id);
CREATE INDEX idx_cargo_plantel ON cargos(plantel_id);
ALTER TABLE pagos MODIFY plantel_id INT NOT NULL;
ALTER TABLE pagos ADD CONSTRAINT fk_pagos_plantel_origen FOREIGN KEY (plantel_id) REFERENCES planteles(id);
CREATE INDEX idx_pago_plantel ON pagos(plantel_id);
ALTER TABLE ordenes_pago MODIFY plantel_id INT NOT NULL;
ALTER TABLE ordenes_pago ADD CONSTRAINT fk_ordenes_pago_plantel_origen FOREIGN KEY (plantel_id) REFERENCES planteles(id);
CREATE INDEX idx_orden_pago_plantel ON ordenes_pago(plantel_id);
ALTER TABLE notificaciones ADD push_pendiente BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE cobranza_envios (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 clave VARCHAR(64) NOT NULL,
 plantel_id INT NOT NULL, usuario_id INT NOT NULL, actor_id INT NOT NULL,
 saldo DECIMAL(12,2) NOT NULL,
 estado VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE', intentos INT NOT NULL DEFAULT 0,
 proximo_intento DATETIME NOT NULL, error VARCHAR(80) NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_cobranza_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT fk_cobranza_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
 CONSTRAINT fk_cobranza_actor FOREIGN KEY (actor_id) REFERENCES usuarios(id)
);
CREATE UNIQUE INDEX uq_cobranza_clave ON cobranza_envios(clave);
