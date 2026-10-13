# Requerimiento: edición integral y controlada de datos institucionales

Estado: especificación revisada contra el código de `main` 1.23.0, después de fusionar los PR #8, #9 y #10. Este PR documenta el estado actual, las diferencias y los criterios de entregas futuras; no implementa formularios, endpoints, permisos ni migraciones y no incrementa la versión.

## Estado actual comprobado

Las rutas de la tabla omiten el prefijo `/api`. `SUPERADMIN` también accede a las operaciones con otros roles según [RolesGuard](../backend/src/common/roles.guard.ts#L20). Los permisos del controlador no sustituyen las validaciones de alcance del servicio.

| Entidad / operación | API y autorización actuales | Web y límites actuales | Evidencia |
| --- | --- | --- | --- |
| Alumno | `PATCH /alumnos/:id`, `ADMINISTRATIVO`, alcance del plantel en servidor. Actualiza nombre, apellidos, teléfono, CURP, nacimiento, dirección y tutor/contacto. | Ya existe edición. Matrícula, correo y plantel no son editables en el formulario; la transferencia y el estado usan acciones separadas. | [Controlador](../backend/src/alumnos/alumnos.controller.ts#L63), [servicio](../backend/src/alumnos/alumnos.service.ts#L182), [web](../web/src/pages/Alumnos.tsx#L104). |
| Docente | `PATCH /docentes/:id`, `ADMINISTRATIVO`. Corrige identidad básica, teléfono, especialidad y cédula. El servicio impide editar globalmente a un docente con asignaciones fuera del alcance del actor. | Ya existe edición. Número de empleado y correo están deshabilitados; asignaciones de plantel y baja son operaciones separadas. | [DTO](../backend/src/docentes/docentes.dto.ts#L33), [servicio](../backend/src/docentes/docentes.service.ts#L151), [web](../web/src/pages/Docentes.tsx#L75). |
| Personal | `PATCH /usuarios/:id/personal`, `SUPERADMIN`; nombre, apellidos, teléfono, contraseña temporal, roles, planteles y activación. Rechaza cuentas de alumno/docente y preserva su gestión por expediente. | Ya existe corrección de cuenta. El correo está deshabilitado y no forma parte del DTO de actualización. Hay además `PATCH /usuarios/:id`, restringido a `SUPERADMIN`, que no sustituye la edición de roles/planteles del personal. | [Controlador](../backend/src/usuarios/usuarios.controller.ts#L14), [servicio](../backend/src/usuarios/usuarios.service.ts#L146), [web](../web/src/pages/Usuarios.tsx#L61). |
| Plantel | `PATCH /planteles/:id`, `SUPERADMIN`; nombre, dirección, municipio, teléfono y activo. La desactivación comprueba alumnos, grupos y personal activos. No permite cambiar clave. | La página permite alta, consulta, dirección y personal, pero no ofrece formulario PATCH para los datos del plantel. | [DTO](../backend/src/planteles/planteles.dto.ts#L16), [servicio](../backend/src/planteles/planteles.service.ts#L75), [web](../web/src/pages/Planteles.tsx). |
| Director | `PUT /planteles/:id/director`, `ADMINISTRATIVO` con alcance por plantel; resuelve un usuario activo de personal por correo y asegura su asignación al plantel. | Ya existe nombramiento por correo. Director es una relación con usuario, no un rol nuevo ni un campo del PATCH genérico del plantel. | [Controlador](../backend/src/planteles/planteles.controller.ts#L42), [servicio](../backend/src/planteles/planteles.service.ts#L89), [web](../web/src/pages/Planteles.tsx#L88). |
| Materia | `PATCH /academico/materias/:id`, `ADMINISTRATIVO`; clave, nombre, descripción y créditos, con control de clave duplicada. Desactivar usa `DELETE` lógico y comprueba clases vigentes. | Ya existe edición de los cuatro campos y desactivación. No debe recrearse el formulario como si faltara. | [Servicio](../backend/src/academico/materias.service.ts#L21), [web](../web/src/pages/Materias.tsx#L47). |
| Grupo | `PATCH /academico/grupos/:id`, `ADMINISTRATIVO`, alcance por plantel. Nombre, grado y turno; rechaza cambiar ciclo y cambiar grado/turno si existen inscripciones. | Ya existe edición; plantel y ciclo están deshabilitados. Materias, docentes e inscripciones tienen operaciones específicas. | [Servicio](../backend/src/academico/grupos.service.ts#L79), [web](../web/src/pages/Grupos.tsx#L89). |
| Ciclo | `PATCH /academico/ciclos/:id`, `ADMINISTRATIVO`; clave, nombre y fechas. Rechaza ciclo cerrado, calendario invertido y `activo` en PATCH. Activar/iniciar cierre/cerrar exige `SUPERADMIN`. | Ya existe edición de ciclos no cerrados y acciones de transición separadas. El servicio actual no limita toda edición exclusivamente a PREPARACION; una política más restrictiva debe evaluarse expresamente. | [Controlador](../backend/src/academico/academico.controller.ts#L46), [servicio](../backend/src/academico/ciclos.service.ts#L98), [web](../web/src/pages/Materias.tsx#L58). |

El cambio de contraseña propia usa `POST /auth/cambiar-password`; recuperación, restablecimiento y cambio inicial tienen flujos separados. No deben confundirse con la contraseña temporal administrada en Personal. Véanse [AuthController](../backend/src/auth/auth.controller.ts#L79) y [Mi cuenta](../web/src/pages/Cuenta.tsx#L19).

## Diferencias confirmadas y decisiones pendientes

### CURP e identidad

- [CrearAlumnoDto](../backend/src/alumnos/alumnos.dto.ts#L30) exige CURP con un patrón de 18 caracteres y normaliza a mayúsculas.
- [ActualizarAlumnoDto](../backend/src/alumnos/alumnos.dto.ts#L54) solo comprueba string y longitud máxima de 18 cuando hay valor; acepta `null` mediante `IsOptional` y no reutiliza el patrón completo del alta. El [servicio](../backend/src/alumnos/alumnos.service.ts#L202) preserva el valor si se omite, pero puede guardar un `null` explícito.
- La [entidad](../backend/src/entities/alumno.entity.ts#L22) y los baselines versionados [MySQL](../database/mysql/baseline_v1.sql#L78) / [SQL Server](../database/sqlserver/baseline_v1.sql#L78) permiten CURP nula. No declaran unicidad de CURP; sí la declaran para matrícula y correo en sus tablas correspondientes. No se comprobó una BD viva.
- El formulario web valida formato para altas y permite editar expedientes históricos sin CURP. Esto está cubierto por [una prueba existente](../web/src/features/alumnos/FormularioAlumno.test.tsx#L39). La edición envía el campo del formulario, que puede estar vacío; no equivale a omitirlo.

Criterio propuesto: no borrar accidentalmente una CURP ya registrada, validar cualquier nueva CURP o corrección con la misma regla de formato del alta y permitir editar otros datos de expedientes históricos sin exigirles completar la CURP. Distinguir campo omitido, vacío y `null` en el contrato y en el formulario. Evaluar duplicados, identidad y datos importados antes de decidir una restricción única o NOT NULL; el patrón actual no certifica por sí solo existencia o identidad oficial.

### Correo, nombramientos e historial

- Cambiar correo, matrícula o número de empleado no está habilitado por los DTO de actualización revisados. Son capacidades nuevas que requieren análisis de dependencias y auditoría; no basta con desbloquear el input.
- La propuesta original de nombramiento exclusivo por `SUPERADMIN` difiere de la autorización vigente `ADMINISTRATIVO` por plantel. Conservar la política actual hasta aprobar expresamente un cambio de permisos; este PR no lo realiza.
- La revocación ya existe en [UsuariosService](../backend/src/usuarios/usuarios.service.ts#L146): actualizar personal incrementa `sessionVersion`; password, estado y roles también tienen reglas de invalidación. No debe prometerse una revocación nueva para toda corrección ordinaria sin definir el caso de identidad.
- Existen transacciones y bloqueos en varios servicios, pero esto no acredita detección de un formulario obsoleto ni auditoría por campo de todas las ediciones. La prevención de sobrescritura y la trazabilidad ampliada son requisitos pendientes.
- No afirmar que todo dato histórico de grupos/materias sea hoy inmutable: el grupo protege ciclo y grado/turno con inscripciones; el ciclo cerrado rechaza su propio PATCH. Cualquier protección adicional del historial o de etiquetas de catálogos debe especificarse y probarse sin alterar notas e inscripciones existentes.

## Política propuesta para entregas funcionales

Esta matriz es un objetivo sujeto a implementación y aprobación de las decisiones anteriores, no el inventario de permisos vigente.

| Entidad | Edición ordinaria propuesta | Operación sensible / especial | No editable directamente |
| --- | --- | --- | --- |
| Usuario/personal | nombre, apellidos y teléfono | correo como corrección de identidad, roles, planteles, activación y contraseña temporal con reglas de revocación | id, passwordHash, sessionVersion, legacyId, timestamps |
| Alumno | nombre, apellidos, teléfono, dirección, nacimiento, tutor y contacto | CURP validada y auditada; matrícula tras evaluar dependencias; transferencia, baja, egreso y reactivación específicos | id, usuarioId, legacyId y fechas de auditoría |
| Docente | nombre, apellidos, teléfono, especialidad y cédula | correo y número empleado, asignaciones, baja y reactivación con dependencias | id, usuarioId y legacyId |
| Plantel / dirección | nombre, dirección, municipio y teléfono | nombramiento con la ruta existente y política aprobada; estado y clave institucional con integridad | id y legacyId |
| Materia | nombre, descripción y créditos | clave y desactivación sujetas a dependencias e historial | id y legacyId |
| Grupo | nombre; grado/turno únicamente si cumplen las restricciones por inscripciones | docentes, materias e inscripciones mediante operaciones específicas | id, plantel y ciclo del grupo existente, legacyId |
| Ciclo | nombre y fechas conforme a estado y calendario | clave, activación y cierre mediante política y acciones correspondientes | id y legacyId; ciclo cerrado sin edición ordinaria |

## Entregas propuestas y aceptación

1. **Personas y contraseñas.** Reutilizar la edición de alumnos, docentes y personal; implementar las diferencias de CURP e identidad aprobadas, sin exigir datos nuevos al editar otro campo de un expediente histórico. Separar contraseña propia, recuperación y contraseña temporal administrada. Probar formato, omisión/null/vacío, duplicados, alcance de dos planteles, cuentas con varios roles, persistencia, fallo/reintento y revocación cuando corresponda.
2. **Planteles y dirección.** Añadir la edición web que falta sobre el PATCH existente; conservar control de desactivación y la ruta PUT de director. Probar usuario de personal activo, autorización/alcance, asignación, dependencias y mensajes de fallo. No endurecer el permiso de director ni habilitar cambio de clave sin decisión explícita.
3. **Catálogos académicos.** Mejorar los formularios existentes, no duplicarlos. Mantener calendario válido, rechazo de ciclo cerrado, ciclo inmutable de grupo, restricciones de grado/turno con inscripciones y desactivación con dependencias. Si se pretende ampliar la inmutabilidad de historial, definir antes sus efectos en catálogos compartidos.
4. **Regresión y UX.** Verificar cada mutación por HTTP y después de recargar/volver a consultar; confirmar que no escribe fuera de alcance. Cubrir `SUPERADMIN`, `ADMINISTRATIVO`, `FINANZAS`, `MAESTRO`, `ALUMNO` y combinaciones; errores, vacío, carga, éxito, doble envío, conservación del formulario, foco/teclado, contraste y responsive. Ejecutar integración MySQL/SQL Server y revisión en dispositivos y lectores de pantalla.

## Condiciones de implementación

- Reutilizar DTO, servicios, endpoints, componentes y convenciones; ampliar contratos existentes solo para los campos aprobados. No crear rutas paralelas de edición ni permitir asignación masiva de propiedades internas.
- Autorizar en backend por operación y alcance con los servicios existentes. En web reflejar permisos y confirmaciones sin sustituir la autorización del servidor.
- Validar y normalizar sin pérdida de datos. Definir unicidad, tratamiento de `undefined`/`null`/vacío y comportamiento ante edición concurrente. Una respuesta de éxito exige persistencia verificada, no solo cambio local del formulario.
- En operaciones sensibles registrar actor, instante, entidad, campo y motivo sin contraseñas, hashes, tokens ni exposición innecesaria de datos personales. Definir la representación y acceso al registro antes de implementarlo.
- No cambiar relaciones académicas por PATCH genérico cuando existan transferencia, baja, activación, cierre, reasignación o promoción específicas. Mantener expedientes y resultados históricos.
- Expo conserva únicamente operaciones personales permitidas al `ALUMNO`; no habilitar administración en la app del alumno.
- No recrear bases, no ejecutar `schema.sql` completo y no activar `DB_SYNC`. Si se requiere un cambio de esquema, preparar entidad TypeORM, migración incremental MySQL y espejo SQL Server según `AGENTS.md`, además de rollback/recuperación y revisión del impacto en datos importados.
- Antes de fusionar cada **PR funcional**, ejecutar los checks de workspaces afectados, pruebas de permisos/HTTP e integraciones; comprobar accesibilidad y UI de los cambios implementados. La CI de este PR documental valida la regresión existente, no acredita las capacidades futuras.

## Versionado

La base efectiva es `main` **1.23.0** y las fases UX #8, #9 y #10 ya están fusionadas. Este PR conserva esa versión. El destino de cada entrega funcional se fijará al abrir su PR: MINOR para capacidad retrocompatible, PATCH para una corrección y evaluación MAJOR si rompe contratos. Mantener versiones del proyecto/Expo sincronizadas y no alterar versiones de dependencias mediante sustituciones globales.

## Evidencia y pendientes de verificación

La revisión cubre los DTO, controladores, servicios y formularios citados, entidades, baselines SQL y pruebas relacionadas de alcance, validación, revocación y estados académicos. Entre ellas: [alta de alumnos](../backend/src/alumnos/alumnos.dto.spec.ts), [alcance docente](../backend/src/docentes/docentes.service.spec.ts), [grupos](../backend/src/academico/academico.service.spec.ts), [sesiones](../backend/src/usuarios/usuarios.service.spec.ts) y [materias/ciclos web](../web/src/pages/Materias.test.tsx). Su existencia no implica cobertura integral de las futuras ediciones.

Quedan por verificar el esquema efectivamente desplegado, calidad de datos importados, dependencias externas de identificadores, política de corrección de identidad, auditoría por campo y resolución de ediciones concurrentes. Comparar únicamente metadatos y estadísticas sanitizadas de staging; no se accedió a staging ni a datos personales reales. Las rutas y líneas enlazadas corresponden al código revisado y deberán revalidarse al implementar.

La validación documental comprueba enlaces/archivos, consistencia de versiones y diff sin cambios funcionales. Los resultados de CI del SHA publicado se registran en el PR. La implementación y certificación UX de las cuatro entregas siguen pendientes.
