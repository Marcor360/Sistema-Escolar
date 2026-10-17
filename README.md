# Sistema Escolar Multiplataforma

**Versión candidata: `1.26.1`** · API, web y app del alumno alineadas. Aceptación institucional y despliegue pendientes.

API, portal administrativo/docente y app del alumno para gestión académica y financiera con alcance por plantel. Las versiones de backend, web, móvil, lockfiles y Expo están alineadas. Este README describe una única versión actual; los informes históricos permanecen en `docs/`.

| Componente | Estado actual |
|---|---|
| API y web | Candidata técnica a primera beta funcional; aceptación del piloto pendiente |
| App del alumno | Candidata a beta del alumno; arranque corregido, pruebas físicas pendientes |
| Base de datos | Baseline v1 y diez migraciones incrementales espejo; MySQL 8.4 / SQL Server 2022 probados en CI |
| ETL de legado | Prototipo parcial; no listo para migración institucional general |

La versión 1.26.1 consolida las altas y activación segura, mejoras de navegación, configuración SMTP y eliminación definitiva protegida. La versión del repositorio identifica el código; la disponibilidad en el VPS o en un APK depende del despliegue correspondiente. La evidencia histórica conserva su versión y fecha originales.

## Novedades de 1.26.1

Esta actualización integra los PR #90–94 sobre la consolidación 1.26.0:

- Personal y docentes reciben una invitación privada para activar su cuenta, sin introducir una contraseña manual al darlos de alta.
- Los docentes requieren cédula profesional o una declaración explícita de cédula pendiente, también en la importación.
- SUPERADMIN puede restablecer el acceso de cuentas pendientes; se invalidan los enlaces anteriores y se exige cambiar la contraseña.
- SMTP reutiliza una conexión con límites de envío; los formularios distinguen nombre, primer apellido y segundo apellido.

### Funciones consolidadas desde 1.26.0

- Inicio del alumno con accesos explicados a materias y tareas, calificaciones, estado de cuenta, perfil y documentos, disponibles aunque el resumen tarde en cargar.
- Menú web organizado por áreas de trabajo; la agenda distingue carga, error y ausencia de eventos y permite reintentar.
- Alta de alumnos sin contraseñas basadas en matrícula: activación privada, invitaciones automáticas y orientación para recuperar acceso. Restablecimiento de acceso administrativo sujeto a permisos.
- Plantillas de correo institucional, entrega SMTP en staging con TLS y rechazo de puertos inválidos.
- **Eliminar definitivamente** en Alumnos, Docentes, Planteles y Personal, solo para SUPERADMIN y con confirmación. Alumnos y docentes se eliminan junto con su cuenta del sistema. Los registros con historial vinculado se conservan mediante baja/desactivación; la eliminación no modifica cuentas ni buzones de GoDaddy. [Reglas y endpoints](docs/ELIMINACION-REGISTROS.md).
- Diagnóstico de staging de solo lectura y regresiones de permisos por plantel e importación según rol.

### Qué puede hacer cada perfil

| Perfil | Recorrido principal |
|---|---|
| SUPERADMIN | Configurar institución y planteles, gestionar personal y eliminar registros sin vínculos |
| Administrativo | Administrar expedientes, grupos, inscripciones, calendario, biblioteca y comunicaciones dentro de su alcance |
| Finanzas | Dar de alta alumnos y dar seguimiento a cargos, pagos y cobranza de sus planteles |
| Maestro | Trabajar con sus clases, materiales, entregas, calificaciones y actividades permitidas |
| Alumno | Activar su cuenta y consultar únicamente sus materias, tareas, notas, documentos y estado de cuenta desde la app |

Los permisos se verifican en la API; una cuenta con varios roles combina únicamente las funciones autorizadas.

## Funcionalidad actual

- Identidad, recuperación y cambio de contraseña, sesiones rotativas, roles y acceso limitado por plantel y expediente vigente.
- Planteles, alumnos, docentes, ciclos, grupos, inscripciones, traslados y promoción; importaciones con preview cifrado y confirmación transaccional.
- Materias, actividades, entregas, calificaciones P1–P3 y Final separado, cierre e historial de correcciones; reportes PDF/Excel y analítica con alcance autorizado.
- Calendario con edición y detección de conflictos, avisos y conducta interna; notificaciones push con cola persistente y contenido genérico.
- Cargos, pagos manuales idempotentes, integración Openpay y correo de cobranza con seguimiento de resultados inciertos.
- Biblioteca privada por plantel con carpetas lógicas, categorías de foto/logo/calendario/documento, cuota y antivirus obligatorio (`clamdscan`); PNG/JPEG/PDF hasta 10 MB. La nueva migración es aditiva y requiere el runner antes de habilitar la biblioteca.
- Archivos con descargas firmadas y validación de alcance; marca institucional mediante `/api/configuracion/marca`.
- App del alumno para inicio, materias, tareas, calificaciones, boleta propia con enlace revocable, perfil y estado de cuenta. Materias y notas ofrecen copia de lectura durante cinco minutos en memoria de la sesión; no persisten expedientes en disco.

La interfaz usa confirmaciones con gestión de foco, tablas adaptables y protección frente a respuestas tardías. La app conserva las consultas disponibles ante fallos parciales; materias y notas ofrecen una copia temporal de lectura. La aceptación con usuarios y dispositivos físicos sigue pendiente.

## Arquitectura y versiones

| Directorio | Responsabilidad / tecnología resuelta |
|---|---|
| `backend/` | NestJS 11.2.7, TypeORM 0.3.31, TypeScript 5.9.3; API y reglas de negocio |
| `web/` | React 18.3.1, Vite 6.4.3, TypeScript 5.9.3; portal administrativo/docente |
| `mobile/` | Expo 57.0.30, React Native 0.86.3, React 19.2.3, TypeScript 6.0.3; app del alumno |
| `database/` | Baseline, esquema documental y migraciones MySQL / SQL Server |
| `etl/` | Python 3.11; extracción y carga parcial del legado |
| `scripts/` | Consistencia, parches, staging, respaldo y restauración |
| `.github/` | CI y despliegue manual controlado |
| `docs/` | Arquitectura, contratos, operación e informes |

Node 24 es la referencia de CI. Los lockfiles fijan las dependencias JavaScript; el ETL mantiene rangos Python y necesita un lock antes de uso institucional. [Arquitectura](docs/ARQUITECTURA.md) · [API](docs/API.md) · [Matriz de acceso](docs/MATRIZ_ACCESO.md).

## Desarrollo y configuración

Requisitos: Node 24, npm y una base MySQL 8.4 o SQL Server 2022 preparada según [Migraciones](docs/MIGRACIONES.md). Para desarrollo local se puede iniciar uno de los motores con Docker Compose: copiar `.env.docker.example` a `.env`, cambiar sus contraseñas y ejecutar `docker compose up -d mysql` o `docker compose --profile mssql up -d sqlserver`. Compose crea volúmenes persistentes; no borres ni recrees una base existente para actualizarla.

En cada componente, copiar su `.env.example` a `.env`, ajustar los valores locales e instalar dependencias con `npm ci`. Ejecutar los bloques siguientes desde la raíz del repositorio, en terminales separadas. No publicar secretos ni reutilizar credenciales de producción. Mantener `DB_SYNC=false`. En `backend/.env`, configurar `DB_TYPE`, conexión a la base y `JWT_SECRET`; si se usa Compose, las credenciales deben coincidir con las del `.env` de la raíz. El ejemplo del backend contiene contraseñas de demostración y no debe usarse tal cual en un entorno compartido.

Antes de iniciar la API, comprobar el historial de migraciones. Sobre una base nueva, seguir el procedimiento de baseline, adopción y migración de la guía; sobre una base existente, auditar el esquema y el historial antes de aplicar cambios. Nunca ejecutar `schema.sql` completo ni usar `DROP` o `TRUNCATE`.

```sh
cd backend
npm ci
npm run build
npm run db:migrate:status
npm run start:dev
```

La API local escucha en `http://localhost:3000` con el `PORT` de ejemplo. El comando `db:migrate:status` consulta el historial; no aplica cambios.

```sh
cd web
npm ci
npm run dev
```

El portal de desarrollo usa `VITE_API_URL=http://localhost:3000/api` en `web/.env`. Para compilarlo, establecer una URL HTTPS absoluta terminada en `/api` mediante el entorno o `web/.env.production`; el valor local del ejemplo sirve solo para `npm run dev`.

Para la app del alumno:

```sh
cd mobile
npm ci
npm start
```

Configurar `EXPO_PUBLIC_API_URL` en `mobile/.env`. El dispositivo debe poder alcanzar la API; `localhost` del teléfono no apunta al ordenador. Preview y producción exigen HTTPS. EAS incluye perfiles de desarrollo, preview y producción, pero hacen falta firma, proyecto Expo y credenciales FCM/APNs para distribución y push nativos. La exportación Expo no equivale a un APK/IPA instalado o aprobado.

Para generar un APK directamente en Windows con Android SDK y Gradle, consultar [Compilar el APK en Windows](docs/COMPILAR_APK_WINDOWS.md).

## Base de datos y seguridad

Los esquemas de ambos motores documentan 42 tablas, con baseline `v1` y diez migraciones incrementales posteriores al baseline, ordenadas en el manifiesto de cada motor. Su estado en un servidor existente debe consultarse: no se certificó la base productiva. Los últimos PR de interfaz no cambian el esquema. [Procedimiento y manifiestos](docs/MIGRACIONES.md).

La API aplica autorización centralizada, validación de datos, límites de solicitudes, contraseñas con hash, acceso de corta duración y refresh rotativo con revocación. El portal usa refresh en cookie HttpOnly/SameSite Strict y acceso en memoria; la app usa SecureStore. Producción exige configuración TLS y secretos adecuados. El portal dispone de CSP y cabeceras de seguridad. Uploads no se publican como carpeta estática; las descargas verifican firma, sesión y permisos. La configuración y operación siguen siendo responsabilidad del despliegue.

La auditoría de dependencias no informó vulnerabilidades conocidas en npm ni en la resolución Python revisada. Esto no constituye certificación de seguridad. La biblioteca privada exige antivirus ClamAV y cuota configurable por plantel; se requieren pruebas del escáner real y políticas institucionales de conservación. Las cargas de otros módulos no están cubiertas por la cuota de la biblioteca. Los parches de dependencias incluidas localmente necesitan mantenimiento.

## Sesiones y cierre por inactividad (API, web y app del alumno)

La sesión vence después de **30 minutos sin interacción humana**: la API comprueba `Sesion.ultimaActividadEn` al autenticar JWT, rechaza la renovación de refresh caducada y admite actividad explícita autenticada por `POST /api/auth/actividad`. Web y Expo mantienen temporizadores locales y el cierre local no depende de la red. El access JWT dura 15 minutos, pero la validez criptográfica del refresh no permite eludir el límite por inactividad. Los procesos automáticos no deben prolongar la sesión.

En web, el login anuncia el cierre por inactividad. La aplicación del alumno muestra un aviso y elimina sus tokens locales; no implementa funciones administrativas. Estas capacidades y sus pruebas de regresión ya estaban implementadas y fusionadas previamente, **no fueron introducidas por el cambio de versión**.

**Comprobación obligatoria en staging:** verificar la versión de backend y web desplegada, el historial de `migracion_sesiones_inactividad.sql` en la base, y probar cierre local y rechazo HTTP 401 pasados 30 minutos, pestañas, suspensión de Android, cierre manual, refresh caducado, reconexión y cambio de usuario. Tener el código en `main` no demuestra que esté instalado en el VPS. No aplicar migraciones sobre la base existente sin respaldo y revisión de estado.

## Estado de las ramas y consolidación

En la consolidación 1.26.0 se auditaron las 89 ramas remotas de trabajo existentes, además de `main`. Los PR ya fusionados y las variantes sustituidas por entregas consolidadas quedan reconocidos en el historial de esta versión. Los cambios vigentes se concentran en `main`; las ramas históricas se conservan como referencias. [Inventario de ramas y criterio de reconciliación](docs/CONSOLIDACION_1.26.0.md).

La numeración 1.26.1 no declara aprobadas las puertas institucionales de piloto, SMTP real, dispositivos físicos ni restauración. Su estado verificable permanece en [BETA_ACEPTACION.json](docs/BETA_ACEPTACION.json).

## Validación y límites actuales

Ejecutar las verificaciones siguientes después de cambiar código. La integración de base de datos requiere bases aisladas para pruebas; los resultados de cortes anteriores están en el [estado de implementación](docs/ESTADO_IMPLEMENTACION.md) y la [evidencia de beta.2](docs/EJECUCION_BETA_1.24.0-beta.2.md). Esos resultados no sustituyen la CI del commit que se vaya a integrar o desplegar.

```sh
# Desde backend/
npm run lint
npm run typecheck
npm test
node ../scripts/check-project-consistency.cjs

# Desde web/
npm run lint
npm test
# Antes del build: configurar VITE_API_URL HTTPS institucional terminada en /api
# mediante el entorno o web/.env.production; el localhost de .env.example es solo para dev.
npm run build

# Desde mobile/
npm test
npx tsc --noEmit

# Desde etl/
python -m unittest discover -s tests
```

Para cambios de esquema, revisar además la entidad TypeORM, la migración incremental MySQL, su espejo SQL Server y la paridad documental de `schema.sql`. Confirmar autorización por plantel en el servidor con `ScopeService`; las opciones visibles en web o móvil no son una barrera de acceso.

Antes del piloto:

- Validar físicamente el arranque móvil ante almacenamiento fallido: el cargador ya tolera lectura, borrado, escritura y red fallidas con marca predeterminada y regresiones automatizadas.
- Antes de migrar legado, completar pipelines y mapeo del ETL y exigir TLS verificado; hoy sólo planteles/alumnos están implementados.
- Probar builds firmados en Android/iOS físicos, push, permisos, reconexión y cambio de cuenta.
- Certificar staging, SMTP/Openpay, permisos, cierre/promoción, copias y restauración con responsables institucionales.

La edición de eventos y la biblioteca administrativa privada están implementadas; no existe una cola académica de escrituras offline ni una biblioteca general para docentes o alumnos. No se certificaron VPS, bases reales, proveedores ni tiendas de aplicaciones durante este barrido.

## Documentación operativa

[Índice de documentación vigente e histórica](docs/README.md) · [Estado beta.2](docs/ESTADO_IMPLEMENTACION.md) · [Contrato de activación segura](docs/REQUERIMIENTO_ACTIVACION_SEGURA.md).

- [Preparación de beta, guía de uso y 30 mejoras](docs/PREPARACION_BETA_1.24.0-beta.1.md)
- [Auditoría base e inventario](docs/AUDITORIA_ESTADO_1.23.5_2026-10-13.md)
- [Reglas del piloto](docs/REGLAS_PILOTO.md)
- [Migraciones y protección de datos existentes](docs/MIGRACIONES.md)
- [Operación de producción](docs/OPERACION_PRODUCCION.md)
- [Staging Windows / IIS](docs/STAGING_WINDOWS_IIS.md)
- [ETL](etl/README.md)
- [Plan de UX, seguridad y piloto](docs/PLAN_UX_SEGURIDAD_PILOTO_2026-10-13.md)
