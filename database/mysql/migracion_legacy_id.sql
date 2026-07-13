-- legacy_id: vínculo con la base certweb para la migración inicial (ETL, strangler fig).
-- MySQL permite múltiples NULL en una columna con índice único, por lo que basta un
-- UNIQUE KEY normal (a diferencia de SQL Server, que requiere un índice filtrado).
ALTER TABLE usuarios ADD COLUMN legacy_id BIGINT NULL, ADD UNIQUE KEY uq_usuarios_legacy (legacy_id);
ALTER TABLE alumnos ADD COLUMN legacy_id BIGINT NULL, ADD UNIQUE KEY uq_alumnos_legacy (legacy_id);
ALTER TABLE docentes ADD COLUMN legacy_id BIGINT NULL, ADD UNIQUE KEY uq_docentes_legacy (legacy_id);
ALTER TABLE planteles ADD COLUMN legacy_id BIGINT NULL, ADD UNIQUE KEY uq_planteles_legacy (legacy_id);
ALTER TABLE ciclos_escolares ADD COLUMN legacy_id BIGINT NULL, ADD UNIQUE KEY uq_ciclos_escolares_legacy (legacy_id);
ALTER TABLE materias ADD COLUMN legacy_id BIGINT NULL, ADD UNIQUE KEY uq_materias_legacy (legacy_id);
ALTER TABLE grupos ADD COLUMN legacy_id BIGINT NULL, ADD UNIQUE KEY uq_grupos_legacy (legacy_id);
ALTER TABLE grupo_materias ADD COLUMN legacy_id BIGINT NULL, ADD UNIQUE KEY uq_grupo_materias_legacy (legacy_id);
ALTER TABLE inscripciones ADD COLUMN legacy_id BIGINT NULL, ADD UNIQUE KEY uq_inscripciones_legacy (legacy_id);
ALTER TABLE conceptos_pago ADD COLUMN legacy_id BIGINT NULL, ADD UNIQUE KEY uq_conceptos_pago_legacy (legacy_id);
ALTER TABLE cargos ADD COLUMN legacy_id BIGINT NULL, ADD UNIQUE KEY uq_cargos_legacy (legacy_id);
ALTER TABLE pagos ADD COLUMN legacy_id BIGINT NULL, ADD UNIQUE KEY uq_pagos_legacy (legacy_id);
