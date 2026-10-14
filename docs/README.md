# Documentación de Sistema Escolar

Entrada de lectura para main 1.24.0-beta.2. Revisión documental: 14 de octubre de 2026, sobre 54a5759cb098a856774e897c4f88dcccebfd2a4b. Las guías vigentes describen el comportamiento actual; las auditorías/versiones antiguas conservan evidencia de su propio corte. Ante diferencias, contrastar estado vigente, controladores/DTO y manifiesto; no ejecutar un procedimiento histórico como si fuera la guía actual.

## Leer según la tarea

| Tarea | Fuente vigente |
|---|---|
| Estado, clasificación y pendientes | [Estado de implementación](ESTADO_IMPLEMENTACION.md) |
| Diseño y contratos | [Arquitectura](ARQUITECTURA.md), [API](API.md), [matriz de acceso](MATRIZ_ACCESO.md) |
| Reglas académicas/financieras | [Reglas del piloto](REGLAS_PILOTO.md) |
| Cierre local por inactividad | [Contrato de 30 minutos y límites](CIERRE_INACTIVIDAD_30M_2026-10-14.md) |
| Requisito de acceso inicial | [Activación segura pendiente](REQUERIMIENTO_ACTIVACION_SEGURA.md) |
| Base nueva o actualización | [Migraciones](MIGRACIONES.md) y [manifiesto](../database/baseline-manifest.json) |
| Operación y servidor | [Operación](OPERACION_PRODUCCION.md), [servidor existente](PUBLICAR_SERVIDOR_EXISTENTE.md), [staging Windows/IIS](STAGING_WINDOWS_IIS.md) |
| Relación con entregables | [Etapas del contrato](ETAPAS_CONTRATO.md); no es acta de aceptación |
| Dependencias y parches | [Política npm e historial](EXCEPCIONES_NPM_AUDIT.md), [vendor móvil](../mobile/vendor/README.md) |
| Evidencia beta.2 | [Ejecución](EJECUCION_BETA_1.24.0-beta.2.md), [documentos/cache Expo](../mobile/docs/AUDITORIA_DOCUMENTOS_CACHE_2026-10-14.md) |
| Aceptación institucional | [Puertas](BETA_ACEPTACION.json) y [QA UX](VALIDACION_UX_ONEST.md) |

## Criterio de mantenimiento

No borrar una auditoría solo por ser antigua: puede conservar requisitos, backfills, restricciones de rollback, reproducciones o resultados ligados a un SHA. No actualizar retrospectivamente sus conteos. Conservar sin cambios cuando no hay información nueva; actualizar guías que se presentan como vigentes y aclarar integración posterior cuando existe nueva evidencia.

Los planes de fases y requisitos 1.23.0 son históricos/propuestas: no implican que todas sus brechas sigan abiertas ni que sus diseños estén implementados. Para pendientes actuales, usar Estado de implementación. Los inventarios mecánicos retirados se recuperan en Git y sus enlaces fueron sustituidos.

## Revisión de cada Markdown original

Se revisaron contenido, propósito, referencias, corte de versión y utilidad de los 44 Markdown originales directamente en docs. La depuración no altera código, versiones, bases, tokens ni puertas de aceptación. Esta tabla conserva la decisión individual.

| Documento original | Decisión | Motivo |
|---|---|---|
| [AMPLIACION_1.15.0.md](AMPLIACION_1.15.0.md) | Conservado sin cambios | Ampliación de dominio, push, conducta y migración con límites históricos. |
| [API.md](API.md) | Actualizado | Contratos beta.2, health live/ready, boletas, biblioteca e importación de notas. |
| [ARCHIVOS_AUDITORIA_1.18.0.md](https://github.com/Marcor360/Sistema-Escolar/blob/706abcf96ac8e684652c741027df1d7f93a5629c/docs/ARCHIVOS_AUDITORIA_1.18.0.md) | Retirado | Solo inventario mecánico, recuperable en Git; sin reglas ni evidencia de prueba propias. |
| [ARCHIVOS_ESTABILIZACION_1.18.1.md](https://github.com/Marcor360/Sistema-Escolar/blob/5951136ad57f921f64aaaa12b6f655a19d9b7b93/docs/ARCHIVOS_ESTABILIZACION_1.18.1.md) | Retirado | Solo inventario mecánico, recuperable en Git; sin reglas ni evidencia de prueba propias. |
| [ARQUITECTURA.md](ARQUITECTURA.md) | Actualizado | Previews persistentes, biblioteca/ClamAV y navegación/caché Expo. |
| [AUDITORIA.md](AUDITORIA.md) | Conservado sin cambios | Diagnóstico inicial con hallazgos y resultados fechados, útil para trazabilidad. |
| [AUDITORIA_2026-10-07.md](AUDITORIA_2026-10-07.md) | Conservado sin cambios | Auditoría del usuario: reglas y criterios originales; historial de correcciones tiene valor propio. |
| [AUDITORIA_ACTUAL_2026-10-05.md](AUDITORIA_ACTUAL_2026-10-05.md) | Conservado sin cambios | Evidencia de dominio y pendientes de ese corte; no es estado vigente. |
| [AUDITORIA_ESTADO_1.23.5_2026-10-13.md](AUDITORIA_ESTADO_1.23.5_2026-10-13.md) | Conservado sin cambios | Inventario/hash/evidencia de alpha y límites del ETL; resultados históricos. |
| [AUDITORIA_PLANTILLAS_Y_PILOTO_2026-10-14.md](AUDITORIA_PLANTILLAS_Y_PILOTO_2026-10-14.md) | Actualizado | Agrega integración #43–44 y requisito de cliente confirmado. |
| [AUDITORIA_UX_BETA_RECORRIDOS_2026-10-13.md](AUDITORIA_UX_BETA_RECORRIDOS_2026-10-13.md) | Conservado sin cambios | Plan de 18 entregas y journeys; ya remite a ejecución posterior. |
| [AVANCE_REMEDIACION_2026-10-02.md](AVANCE_REMEDIACION_2026-10-02.md) | Conservado sin cambios | Evidencia de remediación inicial y cambio de runner. |
| [BARRIDO_1.18.2.md](BARRIDO_1.18.2.md) | Conservado sin cambios | Reproducciones de paginación, Unicode y revocación con regresiones. |
| [BARRIDO_GENERAL_1.18.3.md](BARRIDO_GENERAL_1.18.3.md) | Conservado sin cambios | Correcciones de contratos, fechas, marca y ETL con mediciones. |
| [CONTINUACION_2026-10-05.md](CONTINUACION_2026-10-05.md) | Conservado sin cambios | Evolución de transacciones, idempotencia y sesión; reglas posteriores prevalecen. |
| [CORRECCIONES_1.15.0.md](CORRECCIONES_1.15.0.md) | Conservado sin cambios | Sesiones, identidad, migración y condiciones de despliegue históricas. |
| [CORRECCIONES_1.16.0.md](CORRECCIONES_1.16.0.md) | Conservado sin cambios | Origen financiero/backfill, SMTP incierto y restricciones de rollback. |
| [CORRECCIONES_1.16.1.md](CORRECCIONES_1.16.1.md) | Conservado sin cambios | Matriz de capacidades multirol y pruebas de concurrencia. |
| [EJECUCION_BETA_1.24.0-beta.2.md](EJECUCION_BETA_1.24.0-beta.2.md) | Actualizado | Aclara integración posterior sin alterar resultados originales. |
| [ESTABILIZACION_1.18.0.md](ESTABILIZACION_1.18.0.md) | Actualizado | Conserva evidencia; reemplaza enlace al inventario retirado por su versión Git. |
| [ESTABILIZACION_1.18.1.md](ESTABILIZACION_1.18.1.md) | Actualizado | Conserva evidencia; reemplaza enlace al inventario retirado por su versión Git. |
| [ESTADO_IMPLEMENTACION.md](ESTADO_IMPLEMENTACION.md) | Actualizado | Fuente vigente beta.2, clasificación, evidencias por SHA y requisito de activación. |
| [ETAPAS_CONTRATO.md](ETAPAS_CONTRATO.md) | Actualizado | Seis pestañas, alcance limitado de lectura offline y requisito confirmado. |
| [EXCEPCIONES_NPM_AUDIT.md](EXCEPCIONES_NPM_AUDIT.md) | Actualizado | Política cero excepciones visible antes del historial. |
| [FASE_1_BASELINE_TECNICO.md](FASE_1_BASELINE_TECNICO.md) | Conservado sin cambios | Diagnóstico de metadata/lockfiles y cierre CI del baseline. |
| [MATRIZ_ACCESO.md](MATRIZ_ACCESO.md) | Actualizado | Biblioteca administrativa y documentos propios sin ampliar roles. |
| [MIGRACIONES.md](MIGRACIONES.md) | Actualizado | Ocho incrementales y distinción manifiesto/estado real; elimina observación local caducada. |
| [MODERNIZACION_UX_1.19.0.md](MODERNIZACION_UX_1.19.0.md) | Conservado sin cambios | Fase visual específica, regresiones y límites de accesibilidad del corte; no duplicar estado vigente. |
| [MODERNIZACION_UX_1.20.0.md](MODERNIZACION_UX_1.20.0.md) | Conservado sin cambios | Fase visual específica, regresiones y límites de accesibilidad del corte; no duplicar estado vigente. |
| [MODERNIZACION_UX_1.21.0.md](MODERNIZACION_UX_1.21.0.md) | Conservado sin cambios | Fase visual específica, regresiones y límites de accesibilidad del corte; no duplicar estado vigente. |
| [MODERNIZACION_UX_1.22.0.md](MODERNIZACION_UX_1.22.0.md) | Conservado sin cambios | Fase visual específica, regresiones y límites de accesibilidad del corte; no duplicar estado vigente. |
| [MODERNIZACION_UX_1.23.0.md](MODERNIZACION_UX_1.23.0.md) | Conservado sin cambios | Fase visual específica, regresiones y límites de accesibilidad del corte; no duplicar estado vigente. |
| [OPERACION_PRODUCCION.md](OPERACION_PRODUCCION.md) | Actualizado | Retira diagnóstico local viejo; alinea scripts, readiness, biblioteca y activación. |
| [PLAN_FASES.md](PLAN_FASES.md) | Conservado sin cambios | Plan original asociado a AUDITORIA; criterios históricos, no lista actual de pendientes. |
| [PLAN_UX_SEGURIDAD_PILOTO_2026-10-13.md](PLAN_UX_SEGURIDAD_PILOTO_2026-10-13.md) | Conservado sin cambios | Secuencia de PR, riesgos y criterios del corte original. |
| [PREPARACION_BETA_1.24.0-beta.1.md](PREPARACION_BETA_1.24.0-beta.1.md) | Conservado sin cambios | Inventario de 30 mejoras y pruebas de beta.1; conserva la evidencia original. |
| [PUBLICAR_SERVIDOR_EXISTENTE.md](PUBLICAR_SERVIDOR_EXISTENTE.md) | Conservado sin cambios | Ruta de preparación del servidor existente; complementa staging. |
| [REBARRIDO_1.18.4.md](REBARRIDO_1.18.4.md) | Conservado sin cambios | Compatibilidad bcrypt legacy, sesiones/archivos y carreras corregidas. |
| [REFACTOR_1.17.0.md](REFACTOR_1.17.0.md) | Conservado sin cambios | Responsabilidades, extracción de servicios y pruebas del refactor. |
| [REGLAS_PILOTO.md](REGLAS_PILOTO.md) | Actualizado | Distingue contraseña actual/requisito; agrega notas por archivo, biblioteca y documentos. |
| [REQUERIMIENTO_ARCHIVOS_CALENDARIO_MOBILE.md](REQUERIMIENTO_ARCHIVOS_CALENDARIO_MOBILE.md) | Conservado sin cambios | Propuesta original A–D; no se confunde con implementación beta.2. |
| [REQUERIMIENTO_EDICION_INTEGRAL.md](REQUERIMIENTO_EDICION_INTEGRAL.md) | Conservado sin cambios | Especificación de identidad/CURP/edición con decisiones aún útiles; corte histórico 1.23.0. |
| [STAGING_WINDOWS_IIS.md](STAGING_WINDOWS_IIS.md) | Conservado sin cambios | Procedimiento específico de Windows/IIS, ACL, restore y deploy; sigue vigente. |
| [VALIDACION_UX_ONEST.md](VALIDACION_UX_ONEST.md) | Conservado sin cambios | Matriz de aceptación visual/nativa y evidencia delimitada, útil para QA. |

Resultado: 44 originales, 13 actualizados, 2 retirados y 29 conservados sin cambios. Se añaden este índice y la especificación de activación segura. Git conserva las versiones anteriores y los inventarios retirados.
