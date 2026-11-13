# Sistema Escolar Multiplataforma · IUA

**Versión candidata: `1.36.0`** · Portal del alumno renovado, carga académica guiada y recorridos por tarea y rol. Pruebas técnicas, aceptación institucional y despliegue se acreditan por separado.

Sistema escolar multiplataforma para operación académica, administrativa y financiera. Monorepo TypeScript con una API NestJS como única fuente de reglas de negocio; frontend web React/Vite y aplicación Expo **exclusiva para ALUMNO**. Las funciones de gestión, docentes, finanzas y superadministración solo están en web.

## Estado de la entrega

| Área | Disponible en código | Validación pendiente |
| --- | --- | --- |
| API NestJS | Auth JWT/refresh, roles, planteles, catálogos, alumnos, docentes, calificaciones, cartera, temarios, archivos y finanzas | UAT por sede y servicios externos; CI por SHA en GitHub |
| Portal web | Flujos por rol, buscadores paginados, confirmación antes de operaciones sensibles, gestión académica/financiera | Accesibilidad real, cartera con responsable institucional, logo |
| Expo alumno | Activación, materias, tareas, notas, estado de cuenta, perfil y documentos privados | Instalación Android/iOS física, notificaciones, conexión inestable |
| Consentimiento institucional (1.27.2) | Contrato API, migración espejo y pantalla bloqueante de alumno | **Deshabilitado**: documentos oficiales por nivel, política de privacidad, aceptación de menores y UAT |
| MySQL / SQL Server | Baseline `v1` y migraciones incrementales del manifiesto | Restauración ensayada, historial exacto de cada ambiente |
| ETL legado | Herramientas parciales | Diseño y conciliación de datos de origen; no migración general |

Información vigente: [estado y pendientes](docs/ESTADO_IMPLEMENTACION.md), [índice documental](docs/README.md) e [historial de documentos retirados](docs/HISTORIAL.md).

### Entrega actual

La candidata **1.36.0** reúne el rediseño del portal del alumno, la navegación adaptable y los accesos a tareas, calendario y trámites. Incorpora la entrega web de archivos, la detección de acceso previo para evitar repetir la guía, la preparación académica por pasos y los recorridos administrativos por tarea y rol. No añade migraciones. Las pruebas locales y las exportaciones no acreditan publicación ni aceptación institucional.

- [Portal del alumno](docs/PORTAL_ALUMNO_REFERENCIA_UTC.md): diseño y navegación.
- [Carga académica guiada](docs/CARGA_ACADEMICA_GUIADA.md): orden para materias, grupos y alumnos.
- [Recorridos por tarea](docs/RECORRIDOS_POR_TAREA.md): guías administrativas y del alumno.

- [Barrido y recorrido de alumnos](docs/BARRIDO_Y_CICLO_ALUMNOS_2026-11-02.md): escenarios, resultados, correcciones y límites.
- [Actualización coordinada](docs/ACTUALIZACION_INTEGRAL_1.35.14.md): API, administrativo y Portal Alumno.
- [Preparación del piloto](docs/PILOTO_PRODUCCION.md): responsables, evidencias y criterios para continuar o detener.
- [Historial de entregas](docs/HISTORIAL_VERSIONES.md): cambios anteriores, sin repetirlos como candidatas actuales.

## Arquitectura

| Directorio | Responsabilidad | Tecnología |
| --- | --- | --- |
| `backend/` | API, DTO, guards, autorización, persistencia y endpoints Swagger | NestJS 11, TypeORM, Node 24 |
| `web/` | Operación académica, docencia, administración, finanzas y SUPERADMIN | React 18, Vite 6 |
| `mobile/` | Experiencia alumno: consultas, tareas, calificaciones, avisos y documentos | Expo 57 / React Native |
| `database/` | Baseline y migraciones espejo MySQL 8.4 / SQL Server 2022 | SQL |
| `scripts/` | Consistencia, CI, auditoría, despliegues, respaldos y restauración | Node / PowerShell |
| `docs/` | Contratos de negocio, operación, UAT y evidencias históricas | Markdown / JSON |
| `etl/` | Prototipos de migración desde sistema histórico | Python |

No dupliques lógica de negocio en web o Expo. Los controles de botones y menús **no reemplazan** los guards y filtros por plantel en la API.

## Roles y alcance

| Rol | Web | Expo | Alcance de datos |
| --- | --- | --- | --- |
| SUPERADMIN | Sí | No | Global según autorización |
| ADMINISTRATIVO | Sí | No | Planteles asignados |
| FINANZAS | Sí | No | Planteles autorizados, operaciones financieras |
| MAESTRO | Sí | No | Clases/grupos asignados |
| ALUMNO | Opcional | **Sí** | Únicamente su expediente y registros propios |

En la app móvil no deben existir rutas ni privilegios de gestión administrativa/docente. Las sesiones usan JWT de acceso de 15 minutos, refresh rotativo revocable y **cierre por inactividad de 30 minutos**, validado también en API.

## Preparación de desarrollo

Requisitos: Node.js 24, npm, MySQL 8.4 o SQL Server 2022 de desarrollo. Todos los comandos desde la raíz salvo indicación. Cada workspace tiene **su propio lockfile**; no existe `package.json` raíz. No conectar desarrollo a la base real de staging.

```powershell
cd backend
Copy-Item .env.example .env
# Completar credenciales ficticias o locales de forma segura
npm ci
npm run lint
npm run typecheck
npm test -- --runInBand
npm run build
npm run start:dev
```

```powershell
cd web
Copy-Item .env.example .env
npm ci
npm run lint
npm run test
npm run build
npm run dev
```

```powershell
cd mobile
Copy-Item .env.example .env
npm ci
npm run test
npx tsc --noEmit
npm start
```

Definir `VITE_API_URL` al **compilar** web; Vite incorpora su valor en el bundle. En Expo usar `EXPO_PUBLIC_API_URL`/configuración de `app.config.js` y HTTPS accesible desde el dispositivo: `localhost` en el teléfono no es el servidor.

## Configuración y seguridad

- Mantener secretos solo en `.env`/config protegida; nunca en GitHub, JS generado ni logs. Plantillas: `backend/.env.example`, `backend/.env.staging.example`, `mobile/.env.example`.
- `DB_SYNC=false` en cualquier entorno compartido. No ejecutar `schema.sql` como instalador, ni `DROP`/`TRUNCATE` sobre bases existentes.
- Limitar CORS a orígenes específicos HTTPS y proteger puerto 3000 tras IIS/ARR. TLS obligatorio y certificado validado para BD y SMTP en staging.
- No almacenar tarjetas, códigos OTP, tokens, datos sensibles de menores ni expedientes en logs.
- Los uploads privados se conservan fuera del directorio público y se acceden mediante endpoints autorizados/enlaces firmados; solo logos públicos específicos usan la ruta pública prevista.
- La biblioteca exige antivirus real y límites por plantel. Los flujos de pago de terceros deben conservar idempotencia y verificación de webhook.
- La nueva aceptación institucional se habilita solo tras aprobación de los documentos y de la intervención legal requerida para menores: [contrato de consentimiento](docs/CONSENTIMIENTO_INSTITUCIONAL.md).

## Migraciones sin pérdida de datos

1. Revisar [guía de migraciones](docs/MIGRACIONES.md), [manifiesto](database/baseline-manifest.json), motor y base exactos.
2. Respaldar SQL y uploads, **ensayar restauración en una base aislada**, verificar permisos y duplicados previos.
3. Construir el backend desde el SHA aprobado, consultar `npm run db:migrate:status` en la base correcta y aplicar `npm run db:migrate` solo si corresponde.
4. Validar historial, health `/api/health/live` y `/api/health/ready`, y recorridos institucionales.
5. El rollback de código **no revierte automáticamente** DDL de MySQL. Conservar respaldo y release anterior. No usar `db:migrate:adopt` en base con historial existente.

## Staging Windows Server e IIS

Operación documentada en [STAGING_WINDOWS_IIS.md](docs/STAGING_WINDOWS_IIS.md). Rutas reales de la instalación reportada:

- Checkout fuente: `C:\Builds\sistema-escolar-mvp`
- Release activa: junction `C:\SistemaEscolar\current` → `C:\SistemaEscolar\releases\<version>`
- Configuración privada: `C:\SistemaEscolar\config\backend.env`
- Uploads persistentes: `C:\SistemaEscolar\data\uploads`
- Backups SQL y ZIP: `C:\SistemaEscolar\backups\database`, `backups\uploads`
- API Windows NSSM: `SistemaEscolarApi`
- Portal: https://sistema-staging.iua.edu.mx
- API: https://api-sistema-staging.iua.edu.mx/api

El punto de entrada coordinado `scripts/windows/Update-Staging.ps1` actualiza sistema y Portal Alumno; [guía y configuración](docs/ACTUALIZACION_INTEGRAL_1.35.14.md). Reutiliza `Deploy-Staging.ps1` para compilar API/web, respaldar, aplicar migraciones e intercambiar la junction con comprobaciones de versión. **No reutilizar nombre de release** si ya existe; una actualización del repositorio no actualiza el servidor por sí misma. Para producción usar entornos, bases, certificados, credenciales y respaldos separados.

Como evidencia histórica se confirmó **1.27.17** mediante health local y público, más enlace `current`. La restauración operativa del backup aún necesita evidencia. No se ha verificado aquí la versión actual del servidor; consultar health y la release activa antes de operar.

## Calidad y aceptación

Antes de marcar un PR como listo:

- Backend: `npm run lint`, `npm run typecheck`, `npm test -- --runInBand`, `npm run build`.
- Web: `npm run lint`, `npm run test`, `npm run build`; responsive y recorrido con teclado.
- Expo: `npm run test`, `npx tsc --noEmit` y pruebas físicas.
- CI: `node scripts/check-project-consistency.cjs` y control de incremento semver.
- Cambios de esquema: migraciones MySQL/SQL Server, prueba aislada y revisión de permisos de ambos motores.
- UAT: [matriz](docs/UAT_MATRIZ_2026-10-15.json), [puertas de aceptación](docs/BETA_ACEPTACION.json) y responsables institucionales. Un test verde no sustituye UAT.

## Pendientes reales conocidos

- Evaluaciones: validar formatos oficiales y UAT de la candidata vigente; decimales y aprobación manual confirmados [#210](https://github.com/Marcor360/Sistema-Escolar/issues/210). [Contrato](docs/EVALUACIONES_1.28.0.md).
- Cartera/reinscripción ya implementadas: falta aceptación de esta candidata. Protección de main y proveedor/consentimiento para WhatsApp/llamadas siguen pendientes.
- Restore aislado, antivirus real, pruebas de esta candidata en dispositivos y conciliación del ETL legado.

El solicitante confirmó logo persistente en web/app, correos operativos en ambos proveedores, aceptación de Android y permisos vigentes: #106, #107, #140 y #141 cerrados. Estas confirmaciones no acreditan despliegue o UAT de esta nueva versión ni aceptación de iOS.

## Documentación útil

- [Arquitectura](docs/ARQUITECTURA.md) · [API](docs/API.md) · [matriz de acceso](docs/MATRIZ_ACCESO.md)
- [Catálogos académicos](docs/CATALOGOS_ACADEMICOS.md) · [materias](docs/MATERIAS_Y_ASIGNACIONES.md) · [temarios y ciclos](docs/TEMARIOS_CICLOS.md)
- [Reglas del piloto](docs/REGLAS_PILOTO.md) · [versionado](docs/VERSIONADO_PR.md) · [operación de producción](docs/OPERACION_PRODUCCION.md)
- [Calificaciones](docs/CALIFICACIONES_CONTEXTO.md) · [formatos escolares](docs/FORMATOS_ESCOLARES.md) · [evaluaciones vigentes](docs/EVALUACIONES_1.28.0.md)

**Historial:** los informes retirados se recuperan desde [enlaces a Git](docs/HISTORIAL.md). Las auditorías fechadas conservadas describen únicamente su corte.

## Políticas y formatos pendientes de aceptación

Los formatos escolares son informativos y respetan el régimen de cada clase; [alcance y permisos](docs/FORMATOS_ESCOLARES.md). El reglamento fue confirmado por el solicitante; se conservan decimales y aprobación manual; los formatos oficiales firmados siguen pendientes. Ver [contrato actual](docs/EVALUACIONES_1.28.0.md).

Las altas ordinarias nuevas requieren cartera desde 1.29.0. La bandera histórica `INSCRIPCION_ORDINARIA_SOLO_CARTERA` ya no cambia esa política: Grupos solo reactiva bajas previas del mismo grupo con motivo y referencia documental. No genera cobros retroactivos.
