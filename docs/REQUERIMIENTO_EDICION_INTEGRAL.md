# Requerimiento: edición integral y controlada de datos institucionales

Estado: análisis inicial, pendiente de implementación y QA. Este documento no representa una funcionalidad terminada.

## Evidencia revisada

- `backend/src/entities/{usuario,alumno,docente,plantel,materia,grupo,ciclo-escolar}.entity.ts`
- `backend/src/alumnos/alumnos.dto.ts` y `backend/src/alumnos/alumnos.controller.ts`
- `backend/src/academico/academico.dto.ts` y `backend/src/academico/academico.controller.ts`
- `backend/src/planteles/planteles.dto.ts` y `backend/src/planteles/planteles.controller.ts`
- `backend/src/usuarios/usuarios.controller.ts`
- `docs/ESTABILIZACION_1.18.1.md`

La API ya ofrece PATCH de alumnos, docentes, personal, planteles, ciclos, materias y grupos. Es incorrecto afirmar que todo carece de edición. El alcance pendiente debe verificarse en interfaces web, servicios, pruebas y esquema físico en MySQL/SQL Server. No se ha inspeccionado una base de datos viva.

## Matriz de política propuesta

| Entidad | Edición ordinaria autorizada | Operación sensible/especial | No editable directamente |
| --- | --- | --- | --- |
| Usuario/personal | nombre, apellidos, teléfono, correo con unicidad | roles, planteles, activación, contraseña, cambio de identidad | id, passwordHash, sessionVersion, legacyId, timestamps |
| Alumno | nombre, apellidos, teléfono, dirección, fecha nacimiento, tutor y contacto | corrección CURP validada y auditada; matrícula previa evaluación de dependencias; transferencia, baja, egreso | id, usuarioId, legacyId, fechas de auditoría |
| Docente | nombre, apellidos, contacto, especialidad, cédula | número empleado, asignaciones y baja con dependencias | id, usuarioId, legacyId |
| Plantel | nombre, dirección, municipio, teléfono | director, estado y clave institucional con integridad y autorización | id, legacyId |
| Materia | nombre, descripción, créditos | clave y desactivación sujetas a dependencias | id, legacyId |
| Grupo | nombre, grado, turno | asignación docente/materias; traspasos según contexto | id, plantel/ciclo de grupo existente, legacyId |
| Ciclo | nombre y fechas solo si las reglas del estado lo permiten | activación, cierre, corrección controlada de calendario/clave | id, legacyId; historial cerrado ordinariamente inmutable |

La CURP aparece nullable en la entidad, obligatoria en `CrearAlumnoDto` y permite null en `ActualizarAlumnoDto`. Resolver coherencia: no permitir borrado de CURP obligatoria y verificar formato completo, duplicados, reglas de identidad y procedimiento de corrección. Revisar datos históricos importados antes de endurecer restricciones del esquema.

## Entregas propuestas (PR de implementación independientes)

1. **Personas y contraseñas:** inventario de edición en web; formulario unificado de alumnos, docentes y personal; identidad, correo, CURP, validación, auditoría y revocación de sesión cuando proceda. Mantener recuperación/cambio inicial separados de edición ordinaria.
2. **Planteles y dirección:** editar datos de contacto e identidad; nombramiento del director a través de usuario válido, autorización SUPERADMIN, coherencia de plantel y trazabilidad.
3. **Catálogos académicos:** edición UI/API de materias, grupos y ciclos conforme a estados; protección de ciclo cerrado, historial de notas, inscripciones y transferencias.
4. **Regresión y UX:** matriz de roles/planteles, accesibilidad AA, teclado, confirmación de cambios críticos, errores, loading, vacío, éxito, no doble envío y conservación del formulario, responsive; pruebas MySQL y SQL Server.

## Condiciones obligatorias

- Reutilizar DTO, servicios, endpoints, componentes y convenciones existentes; no crear endpoints duplicados.
- Aplicar permiso en backend por operación y alcance institucional; en web ocultar/deshabilitar coherentemente, nunca sustituir autorización.
- Validaciones servidor/cliente con mensajes en español, normalización sin pérdida de datos, unicidad y prevención de concurrencia.
- Para cambios sensibles guardar actor, instante, entidad, campo y motivo sin registrar secretos; protección reforzada para menores.
- No editar relaciones académicas mediante PATCH genérico cuando existan transferencia, baja, activación, cierre, reasignación o promoción específicas.
- La app Expo solo puede ofrecer operaciones personales permitidas al ALUMNO; jamás pantallas administrativas.
- Evaluar migraciones espejo únicamente si el esquema físico lo requiere; DB_SYNC=false. No alterar tablas históricas sin necesidad.
- Antes de fusionar: lint, typecheck, build, tests de workspaces afectados, integración MySQL/SQL Server, regresión HTTP, pruebas de permisos, revisión WCAG AA y CI.

## Versionado y dependencias

Versión de destino **sin asignar** hasta confirmar la versión efectiva de la rama base y las ramas UX pendientes (#8, #9, #10). Las mejoras funcionales retrocompatibles justifican MINOR; los fixes sin nueva capacidad PATCH; los cambios incompatibles requieren evaluación MAJOR. No reutilizar `1.21.0` si pertenece a la fase UX; no incrementar versiones por un PR puramente documental. Mantener versiones sincronizadas al implementar y evitar PR de implementación solapados con las ramas UX.

## Pendientes de verificación

Inspeccionar íntegramente `web/`, servicios de dominio, migraciones físicas y pruebas existentes; comparar con BD de staging usando metadatos sanitizados, nunca datos personales reales. Registrar rutas y líneas de hallazgos y resultados reales de CI antes de declarar completado.
