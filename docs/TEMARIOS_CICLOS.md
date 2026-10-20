# Temarios y ficha de ciclo — 1.27.0

Los temas pertenecen a una clase (`GrupoMateria`). No crean tareas, entregas, calificaciones, inscripciones ni cargos. El parcial 1–3 es una referencia informativa opcional, sin peso ni promedio. Se conserva la normativa actual de #102.

## Autorización y publicación

SUPERADMIN gestiona todas las clases; ADMINISTRATIVO, las de sus planteles; MAESTRO, solo las asignadas. La escritura exige grupo, ciclo y plantel vigentes. Lectura histórica de responsables conserva el contenido. ALUMNO solo consulta clases con inscripción vigente o participación válida en recursamiento; nunca dispone de edición ni historial de responsables. FINANZAS no obtiene acceso a temarios. Las cuentas con varios roles no convierten una inscripción de alumno en autorización docente.

Estados: BORRADOR (responsables), PUBLICADO (alumnos inscritos durante la ventana), CANCELADO (histórico de responsables). Publicación sin fechas es inmediata y sin límite; fechas nulas representan ausencia de límite. La API exige ISO 8601 con zona; la web convierte desde la hora local del dispositivo. No existe publicación por turno ajeno: el contexto se deriva de la clase. Los cambios posteriores a cancelación se rechazan. El orden positivo es único por clase y no se reutiliza tras cancelar.

Cada mutación exige la revisión vigente, bloquea el tema y registra una revisión completa de texto, contexto de publicación y metadatos de adjuntos junto con una entrada de bitácora académica, en la misma transacción. Una edición concurrente devuelve 409. El historial no permite reescribir versiones ni recuperar archivos físicamente retirados.

## API

- GET `/grupo-materias/:id/temario`: `pagina=1`, `porPagina=10` (máximo 100), búsqueda literal `buscar`; alumnos reciben exclusivamente publicaciones disponibles.
- GET `/temarios/:id`: detalle autorizado y metadatos de adjuntos, sin rutas de disco.
- POST `/temarios`: `grupoMateriaId`, `indice` (1–10000), `titulo` (150), `contenido` en texto (20000); estado BORRADOR/PUBLICADO, fechas, parcial y enlace HTTPS opcionales.
- PATCH `/temarios/:id`: campos editables y `revision` obligatoria; nunca cambia la clase de un tema existente.
- POST `/temarios/:id/cancelar`: revisión y motivo; conserva historial.
- POST `/temarios/:id/adjuntos`: multipart `archivo` y `revision`; máximo 20 adjuntos vigentes por tema, límites de formatos/tamaño e inspección de firmas del sistema.
- DELETE `/temarios/:id/adjuntos/:adjuntoId`: cuerpo con revisión; baja lógica y limpieza de archivo en cola transaccional.
- GET `/temarios/:id/historial`: páginas de diez, solo responsables.
- GET `/archivos/temarios/:id/enlace`: firma de cinco minutos ligada a sesión. La descarga revalida sesión, pertenencia, publicación y adjunto vigente; cancelar, retirar, revocar sesión o terminar la ventana impide usar enlaces anteriores. El recurso se descarga como adjunto privado y no se expone `/uploads`.
- GET `/academico/ciclos/:id/ficha`: resumen y grupos paginados (`pagina`); asignaturas/docentes tienen paginación propia (`clasesPagina`). Diez por defecto y máximo cien. `buscar` filtra nombre del grupo; `plantelId` requiere alcance autorizado. No devuelve expedientes, correos ni notas de alumnos. ADMINISTRATIVO/FINANZAS por sede, MAESTRO solo sus grupos y sus asignaturas, SUPERADMIN global. El alumno no accede a esta ficha administrativa.

La web ofrece panel de acciones, consulta por clase, formulario enfocado para crear/editar y otro para adjuntar, confirmación de abandono y de cambio de clase con borrador, errores recuperables y URL para filtros/página. Expo solo ofrece lectura publicada desde Materias, carga a petición y páginas del servidor, sin guardar temas o enlaces privados en disco.

## Migración y operación

`database/{mysql,sqlserver}/migracion_temarios.sql` añade `temas`, `tema_adjuntos` y `tema_revisiones`, con claves y restricciones. Está al final del manifiesto del runner; los esquemas completos solo documentan paridad. No se recrean bases ni se activa sincronización. Aplicar el runner incremental con respaldo verificado antes de desplegar API/clientes que usan estas tablas; comprobar estado del runner y validar ambos motores en copia aislada. La reversión de aplicación debe conservar las tablas y sus datos; no se suministra un borrado destructivo.

Los tests automáticos no equivalen a aceptación de planteles, dispositivos físicos o puesta en producción. Los formatos oficiales de actas, nuevas fórmulas de evaluación y cambios de permisos institucionales permanecen separados.
