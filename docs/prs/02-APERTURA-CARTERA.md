# Apertura de cartera — contrato de integración

## Diagnóstico inicial (superado por la implementación)
La revisión inicial encontró entidades académicas y financieras separadas, sin ruta de apertura ni transacción coordinada. La implementación descrita al final añade ambos recorridos; este diagnóstico conserva el origen del trabajo.

## Archivos a intervenir en la implementación
- `backend/src/alumnos/`, `backend/src/academico/` y `backend/src/finanzas/`: orquestación en **backend** y validación de permisos por plantel.
- `backend/src/entities/` y `database/mysql/`, `database/sqlserver/`: solo si los catálogos y estados del flujo requieren nuevos campos; migraciones espejo y compatibilidad histórica.
- `web/src/App.tsx`, `web/src/layout/Shell.tsx`, `web/src/pages/Alumnos.tsx`: entrada **visible** “Apertura de cartera” para Control Escolar/Finanzas según matriz autorizada; vista enfocada, nunca en Expo.
- Pruebas unitarias y `backend/test/integration/`: reintento, rollback y alcance por rol.

## Recorrido objetivo
1. Seleccionar alumno existente o terminar alta según permisos.
2. Plantel → nivel → carrera/plan → ciclo → periodo → turno → modalidad.
3. Elegir grupo regular compatible o solicitar planificación automática **solo** para modalidad ordinaria.
4. Previsualizar inscripción/conceptos/precios provenientes de FINANZAS, **sin** confiar en montos del cliente.
5. Confirmar una única vez con clave de idempotencia y bitácora. Si hay error, no dejar ni grupo ni cargo huérfano.
6. Si la cohorte regular tiene 1–4 alumnos sin grupo compatible, registrar condición pendiente sin habilitar grupo irregular.

## Exclusiones
Ni recursamiento ni programas especiales abren cartera ordinaria. Preservar datos históricos, activación segura y recibos. No inventar catálogo de precios.

## Decisiones iniciales y resolución
Se resolvieron mediante catálogos configurables (#97), agrupación conservadora sin mover historial (#99), tarifas existentes de Finanzas y gestión de SUPERADMIN/ADMINISTRATIVO. Las fechas se eligen explícitamente dentro del ciclo; no se inventan tarifas ni calendarios oficiales.

## Aceptación
Alta simple, doble clic, dos administradores concurrentes, alumnos de planteles distintos, fallos de cargo, transferencia y rollback probados en MySQL y SQL Server; UI con carga/vacío/error/éxito.

## Implementación y reglas confirmadas
Módulo web visible `/apertura-cartera` y API `/cartera`, solo SUPERADMIN/ADMINISTRATIVO con alcance del plantel. Selecciona alumno existente, catálogos completos, ciclo y turno; grupo compatible opcional. La previsualización obtiene conceptos activos y montos exclusivamente del servidor. Confirmación mediante UUID, huella de petición y cotización que detecta tarifas modificadas; los reintentos conservan la misma apertura.

La transacción READ COMMITTED comparte agrupación, inscripción, cargos y bitácoras. Una solicitud sin grupo queda PENDIENTE y sin cargos; la quinta solicitud válida activa las aperturas de la cohorte con los precios confirmados guardados por servidor, sin inventar tarifas. Los alumnos inactivos o trasladados antes de agrupar requieren revisión. No se mueven grupos existentes ni se incluyen especiales o recursantes. La colegiatura reutiliza la clave de generación vigente y bloquea cargos históricos incompatibles para evitar duplicados. No se crean cuentas ni se procesa un precio recibido del cliente.

Pruebas de integración: cambio de tarifa, confirmación duplicada concurrente, autorización, cinco alumnos, fallo sintético de cargo con rollback de toda la cohorte, reintento, montos no aceptados y consulta paginada. Migraciones incrementales espejo; staging no desplegado.
