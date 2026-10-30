# Boletas: pendientes y atención · candidata 1.35.0

29/oct/2026, America/Mexico_City. Amplía el contrato [1.34.0](BOLETAS_FIRMADAS_1.34.0.md). Sin despliegue, cambios institucionales de datos ni aprobación UAT.

## Recorrido

- La bandeja parte de inscripciones: una boleta publicada aparece aunque todavía no tenga respuesta familiar. Una versión modificada vuelve a Pendiente de aceptación. El filtro Aceptadas/Con comentarios permite consultar la última respuesta histórica, identificada expresamente cuando es anterior; el filtro de atención exige una revisión vigente.
- Búsqueda por nombre, apellido o matrícula; filtros de plantel, ciclo, grupo y atención. Cambiar categoría conserva filtros. Los selectores consultan solamente contextos autorizados, también para Director y profesor.
- Administración, Dirección y SUPERADMIN asignan un responsable activo con alcance en el plantel o grupo y registran Pendiente/En atención/Resuelta. Se requiere En atención antes de resolver y un comentario no vacío de hasta 2000 caracteres en cada cambio. Una revisión resuelta se reabre pasando a En atención. No cambia ninguna nota ni acepta por la familia. El docente conserva su capacidad de comentar solo materias propias.
- El responsable puede ser un administrador/director del plantel, un docente activo asignado al grupo o SUPERADMIN. La asignación no concede permisos adicionales. Los comentarios de atención son generales a la solicitud familiar; el historial de comentarios académicos continúa separado por materia.
- Cada evento de atención queda asociado a la respuesta familiar concreta. Una nueva respuesta o cambio de notas impide atender la revisión anterior, pero conserva sus eventos. Se muestran hasta 100 eventos recientes de cada historial.
- Inicio de Expo Web/Android/iOS consulta boletas publicadas pendientes. Los cambios de versión se reflejan al actualizar/volver a Inicio. Los comentarios docentes y cambios de atención crean avisos internos en la misma transacción, sin correo ni push. No hay tareas automáticas, envío a proveedores ni mensajes en tiempo real; las pantallas se actualizan al entrar o reintentar.
- La constancia PDF descarga un evento ACEPTADA y la fotografía académica que se aceptó. Incluye folio, nombre, tipo declarado, fecha UTC y huella de versión. Es privada para el alumno propietario y Administración/Dirección dentro de su alcance, SUPERADMIN global. El profesor no descarga otras materias mediante la constancia. Se permite descargar aceptaciones históricas sin presentarlas como versión vigente. No certifica identidad independiente del tutor ni firma electrónica oficial.

## Contratos

- `GET /api/boletas/seguimiento`: estado PENDIENTE_RESPUESTA/ACEPTADA/REVISION, plantelId, cicloId, grupoId, buscar, atencion, pagina y porPagina.
- `GET /api/boletas/filtros?tipo=plantel|ciclo|grupo`: selectores paginados dentro del alcance; permite buscar y acotar grupos por plantel/ciclo.
- `GET /api/boletas/mis-pendientes`: exclusivo de alumno, datos propios y total de pendientes publicados.
- `GET /api/boletas/inscripciones/:id`: añade responsables elegibles para gestores, revisionId, estado actual e historial de atención; mantiene materias según permisos.
- `POST /api/boletas/inscripciones/:id/atencion`: clave UUID, respuestaId, versionHash, responsableId, estado y comentario. Idempotencia y bloqueo del ciclo serializan cambios y notas.
- `GET /api/boletas/inscripciones/:id/constancias/:respuestaId/pdf`: descarga autenticada y privada.
- `GET /api/reportes/mi-boleta/enlace?formato=constancia-aceptacion&inscripcionId=...&respuestaId=...`: sesión alumno, enlace firmado de dos minutos que conserva respuesta e inscripción. La descarga revalida sesión y propiedad.

## Datos, rendimiento y compatibilidad

La migración incremental `migracion_boleta_atenciones.sql` tiene espejo MySQL/SQL Server y crea eventos aditivos con FK restrictivas, UUID único, índice por respuesta y constraint de estados. No modifica notas/respuestas previas. El manifiesto y las entidades se mantienen sincronizados. `schema.sql` es documental.

Las versiones académicas se cargan con tres consultas por lote, compartidas por detalle y bandeja. La bandeja recorre lotes de hasta 100 inscripciones y aplica publicación/huella antes de paginar, para dar totales correctos sin saltar pendientes. El cálculo sigue siendo lineal en las inscripciones que coinciden con el contexto: para bases muy grandes podría requerirse una proyección persistida, sin sustituir ahora las reglas de cierre por un estado ficticio. Los selectores de contexto solo cargan metadatos autorizados. En Reinscripción se separan las autorizaciones financieras y el historial en componentes propios: la pantalla principal pasa de 651 a 561 líneas, conservando eventos, permisos y confirmaciones. Se unifica la apertura/descarga firmada en Expo y se conserva la protección frente a cambios de inscripción durante una descarga.

Clientes 1.34.0 conservan sus rutas anteriores y omiten los campos nuevos. El listado acepta sus estados anteriores; los clientes nuevos requieren API y migración 1.35.0. Resolver una revisión no altera el contrato de aceptación familiar.

## Validación

Validación local con datos ficticios:

- Backend: 101 suites / 578 pruebas unitarias aprobadas, lint/tipos y compilación.
- Web: 74 archivos / 270 pruebas aprobadas; repetición focalizada de atención, filtros y respuesta familiar (4 pruebas) tras los últimos ajustes. Lint y build aprobados. Las tres pruebas existentes de Reinscripción se repitieron y aprobaron tras separar autorizaciones e historial.
- Expo: 27 archivos / 143 pruebas y 11 comprobaciones de scripts aprobadas; TypeScript y exportaciones web/Android aprobadas. Android exporta un bundle, no un APK firmado.
- Integración del escenario ampliado de boletas: 1 aprobado / 131 omitidos por filtro en cada motor, MySQL 8.4 y SQL Server 2022. Comprueba pendientes sin respuesta, búsquedas/contexto, responsable elegible, transiciones, reintentos, avisos, constancia autenticada/firmada, aceptación histórica y denegación de alumno ajeno/docente dado de baja.
- Navegador administrativo: SUPERADMIN y MAESTRO en 360/768/1280/1920 px, atención y comentarios por materia, sin errores JavaScript ni desbordamiento global. Reglas axe WCAG 2 A/AA y 2.1 AA ejecutadas sin infracciones reportadas; no es certificación completa.
- Expo Web en los mismos cuatro anchos: aviso de pendiente, revisión de 2000 caracteres, respuesta del personal, aceptación y descarga de constancia, navegación y cierre de sesión. API simulada; no acredita proveedores ni dispositivos físicos.
- Consistencia de metadatos 1.35.0, rutas y migraciones espejo aprobada. Pruebas completas de integración remota y CI del SHA de entrega se registran en el PR cuando existan, sin atribuir automáticamente la evidencia de 1.34.0.
- Los primeros intentos locales detectaron el prefijo obligatorio de las bases de integración, una aserción que esperaba lista vacía en lugar del rechazo 401 del docente dado de baja y un proceso de migración terminado al ejecutar ambos motores simultáneamente con recursos limitados. Se corrigieron los datos/aserciones del ensayo y se repitieron secuencialmente con bases nuevas, sin reiniciar ni vaciar bases existentes.

UAT-63 queda pendiente. El solicitante confirmó conservar decimales y aprobación manual del docente; no se habilita redondeo automático. #210 conserva pendientes de formatos oficiales y UAT, no una solicitud nueva de reglas. Los formatos oficiales requieren validación institucional. La protección de main (#158) depende de un permiso administrativo de GitHub que la integración ha rechazado con 403; no se simula mediante código ni se elimina la revisión independiente.
