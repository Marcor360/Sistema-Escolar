# Documentación de Sistema Escolar

Entrada de lectura para la candidata 1.27.20. Revisión documental: 21 de octubre de 2026. Las guías vigentes describen el código consolidado; las auditorías anteriores conservan su propio corte. El README principal resume las funciones y los requisitos de desarrollo, operación y validación.

## Leer según la tarea

| Tarea | Fuente vigente |
|---|---|
| Código, evidencias y pendientes actuales | [Estado de implementación](ESTADO_IMPLEMENTACION.md) |
| Logos, caché de marca y diagnóstico IIS | [Contrato WebP y UAT](LOGO_WEBP_STAGING_1.27.18.md) |
| Versionado único y correlativo por PR | [Política de versiones](VERSIONADO_PR.md) |
| Referencias de ciclo, materias, temario, docente y cartera | [Contrato académico 18/oct](CONTRATO_ACADEMICO_REFERENCIAS_2026-10-18.md) |
| Informes retirados e inventarios históricos | [Historial recuperable en Git](HISTORIAL.md) |
| Baja y eliminación definitiva | [Reglas de eliminación](ELIMINACION-REGISTROS.md) |
| Barrido responsivo, matriz y límites | [Revisión del 15 de octubre](BARRIDO_RESPONSIVO_2026-10-15.md) |
| Aceptación por rol y canal | [Matriz UAT pendiente](UAT_MATRIZ_2026-10-15.json) y [operación](OPERACION_PRODUCCION.md) |
| Estado, clasificación y pendientes | [Estado de implementación](ESTADO_IMPLEMENTACION.md) |
| Diseño y contratos | [Arquitectura](ARQUITECTURA.md), [API](API.md), [matriz de acceso](MATRIZ_ACCESO.md) |
| Reglas académicas/financieras | [Reglas del piloto](REGLAS_PILOTO.md) |
| Inactividad de API y migración | [Contrato integrado de #47–51](SESIONES_INACTIVIDAD_PLAN.md) |
| Cierre local por inactividad | [Contrato de 30 minutos y límites](CIERRE_INACTIVIDAD_30M_2026-10-14.md) |
| Requisito de acceso inicial | [Contrato de activación segura](REQUERIMIENTO_ACTIVACION_SEGURA.md) |
| Base nueva o actualización | [Migraciones](MIGRACIONES.md) y [manifiesto](../database/baseline-manifest.json) |
| Operación y servidor | [Operación](OPERACION_PRODUCCION.md), [servidor existente](PUBLICAR_SERVIDOR_EXISTENTE.md), [staging Windows/IIS](STAGING_WINDOWS_IIS.md) |
| Relación con entregables | [Etapas del contrato](ETAPAS_CONTRATO.md); no es acta de aceptación |
| Dependencias y parches | [Política npm e historial](EXCEPCIONES_NPM_AUDIT.md), [vendor móvil](../mobile/vendor/README.md) |
| Adjuntos del alumno | [Privacidad y límites del selector Expo](../mobile/docs/PRIVACIDAD_SELECTOR_ARCHIVOS_2026-10-14.md) |
| Evidencia beta.2 | [Ejecución](EJECUCION_BETA_1.24.0-beta.2.md), [documentos/cache Expo](../mobile/docs/AUDITORIA_DOCUMENTOS_CACHE_2026-10-14.md) |
| Aceptación institucional | [Puertas](BETA_ACEPTACION.json) y [QA UX](VALIDACION_UX_ONEST.md) |
| Temarios y ficha integral de ciclo | [Temarios y ciclos](TEMARIOS_CICLOS.md) |
| Evaluación y actas: decisiones pendientes | [Plan condicionado](PLAN_CALIFICACIONES_ACTAS_1.28.0.md) y [anexo técnico propuesto](IMPLEMENTACION_EVALUACIONES_1.28.0.md) |

## Mantenimiento

Las guías operativas describen el código actual. Los informes fechados conservados son evidencia de su corte; no prueban el estado del servidor ni reemplazan las guías vigentes. Los resúmenes integrados y el inventario mecánico retirados se consultan en [Git](HISTORIAL.md).

Antes de eliminar otro archivo, comprobar usos y enlaces y conservar requisitos, migraciones, recuperación operativa y evidencias que todavía respaldan una decisión. CI valida estructura de puertas y UAT; aprobarlas requiere sus evidencias institucionales.
