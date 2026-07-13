-- legacy_id: vínculo con la base certweb para la migración inicial (ETL, strangler fig).
-- SQL Server no permite varios NULL en un índice UNIQUE normal, por lo que se usa un
-- índice único filtrado (WHERE legacy_id IS NOT NULL).
ALTER TABLE usuarios ADD legacy_id BIGINT NULL;
GO
CREATE UNIQUE INDEX uq_usuarios_legacy ON usuarios(legacy_id) WHERE legacy_id IS NOT NULL;
GO

ALTER TABLE alumnos ADD legacy_id BIGINT NULL;
GO
CREATE UNIQUE INDEX uq_alumnos_legacy ON alumnos(legacy_id) WHERE legacy_id IS NOT NULL;
GO

ALTER TABLE docentes ADD legacy_id BIGINT NULL;
GO
CREATE UNIQUE INDEX uq_docentes_legacy ON docentes(legacy_id) WHERE legacy_id IS NOT NULL;
GO

ALTER TABLE planteles ADD legacy_id BIGINT NULL;
GO
CREATE UNIQUE INDEX uq_planteles_legacy ON planteles(legacy_id) WHERE legacy_id IS NOT NULL;
GO

ALTER TABLE ciclos_escolares ADD legacy_id BIGINT NULL;
GO
CREATE UNIQUE INDEX uq_ciclos_escolares_legacy ON ciclos_escolares(legacy_id) WHERE legacy_id IS NOT NULL;
GO

ALTER TABLE materias ADD legacy_id BIGINT NULL;
GO
CREATE UNIQUE INDEX uq_materias_legacy ON materias(legacy_id) WHERE legacy_id IS NOT NULL;
GO

ALTER TABLE grupos ADD legacy_id BIGINT NULL;
GO
CREATE UNIQUE INDEX uq_grupos_legacy ON grupos(legacy_id) WHERE legacy_id IS NOT NULL;
GO

ALTER TABLE grupo_materias ADD legacy_id BIGINT NULL;
GO
CREATE UNIQUE INDEX uq_grupo_materias_legacy ON grupo_materias(legacy_id) WHERE legacy_id IS NOT NULL;
GO

ALTER TABLE inscripciones ADD legacy_id BIGINT NULL;
GO
CREATE UNIQUE INDEX uq_inscripciones_legacy ON inscripciones(legacy_id) WHERE legacy_id IS NOT NULL;
GO

ALTER TABLE conceptos_pago ADD legacy_id BIGINT NULL;
GO
CREATE UNIQUE INDEX uq_conceptos_pago_legacy ON conceptos_pago(legacy_id) WHERE legacy_id IS NOT NULL;
GO

ALTER TABLE cargos ADD legacy_id BIGINT NULL;
GO
CREATE UNIQUE INDEX uq_cargos_legacy ON cargos(legacy_id) WHERE legacy_id IS NOT NULL;
GO

ALTER TABLE pagos ADD legacy_id BIGINT NULL;
GO
CREATE UNIQUE INDEX uq_pagos_legacy ON pagos(legacy_id) WHERE legacy_id IS NOT NULL;
GO
