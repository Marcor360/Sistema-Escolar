# Sistema Escolar Multiplataforma · IUA

**Versión candidata de código: `1.27.6`** · Estado: revisión técnica y aceptación institucional pendientes. Esta versión documenta el proyecto; **no demuestra despliegue adicional**. Staging confirmado por el operador en **1.27.1** (commit `b464d40`), con API `/health/ready` local y HTTPS correctas. La app Expo instalada en dispositivos **no se actualiza automáticamente**.

Sistema escolar multiplataforma para operación académica, administrativa y financiera. Monorepo TypeScript con una API NestJS como única fuente de reglas de negocio; frontend web React/Vite y aplicación Expo **exclusiva para ALUMNO**. Las funciones de gestión, docentes, finanzas y superadministración solo están en web.

## Estado de la entrega

| Área | Disponible en código | Validación pendiente |
| --- | --- | --- |
| API NestJS | Auth JWT/refresh, roles, planteles, catálogos, alumnos, docentes, calificaciones, cartera, temarios, archivos y finanzas | Pruebas integradas y UAT por sede con datos controlados |
| Portal web | Flujos por rol, buscadores paginados, confirmación antes de operaciones sensibles, gestión académica/financiera | Accesibilidad real, cartera con responsable institucional, logo |
| Expo alumno | Activación, materias, tareas, notas, estado de cuenta, perfil y documentos privados | Instalación Android/iOS física, notificaciones, conexión inestable |
| Consentimiento institucional (1.27.2) | Contrato API, migración espejo y pantalla bloqueante de alumno | **Deshabilitado**: documentos oficiales por nivel, política de privacidad, aceptación de menores y UAT |
| MySQL / SQL Server | Baseline `v1` y migraciones incrementales del manifiesto | Restauración ensayada, historial exacto de cada ambiente |
| ETL legado | Herramientas parciales | Diseño y conciliación de datos de origen; no migración general |

### Funcionalidad destacada de versiones recientes

- **1.27.6:** la inscripción directa limita el grupo regular a 50 alumnos activos (o menos cuando hay reservas de recursamiento); el remanente excepcional 51–54 sigue reservado al motor automático de cartera. Inscripción directa todavía no genera cargos; no usarla como alta financiera. Validación institucional pendiente.
- **1.27.5:** accesibilidad base de navegación enfocada, reintentos de búsqueda y ancho de formularios; UAT con usuarios todavía pendiente.
- **1.27.4:** apertura de cartera con estados explicados, resumen de cotizaciones, tabla adaptable y matrícula/nombre autorizados; no cambia agrupación ni tarifas.
- **1.27.3:** reorganización integral de README y mapa de operación; no añade reglas de negocio.
- **1.27.2:** consentimiento institucional versionado en API/Expo, pendiente de habilitación administrativa.
- **1.27.1:** `Mis clases` por operación (actividades, materiales, entregas); consultas paginadas y formularios enfocados.
- **1.27.0:** temarios independientes por clase, publicaciones con fechas, historial, adjuntos privados y ficha de ciclo.
- **1.26.6:** consulta, captura e importación de calificaciones separadas.
- **1.26.5:** consultas paginadas de materias y calificaciones propias.
- **1.26.4:** distingue vigencia de ciclo, mes de cobro y vencimiento en cartera.
- **1.26.3:** guía contextual y navegación de ciclos y grupos.
- **1.26.2:** control de versionado por PR.
- **1.26.1 / 1.26.0:** invitaciones por correo, activación y recuperación seguras, plantillas SMTP, permisos y mejoras de UI.

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

El procedimiento oficial `scripts/windows/Deploy-Staging.ps1` compila API/web, respalda, valida y aplica migraciones, intercambia la junction y comprueba versiones local/pública. **No reutilizar nombre de release** si ya existe; una actualización del repositorio no actualiza el servidor por sí misma. Para producción usar entornos, bases, certificados, credenciales y respaldos separados.

En la instalación de staging se confirmó **1.27.1** mediante health local y público, más enlace `current`. La restauración operativa del backup aún necesita evidencia. Versiones candidatas posteriores no están desplegadas.

## Calidad y aceptación

Antes de marcar un PR como listo:

- Backend: `npm run lint`, `npm run typecheck`, `npm test -- --runInBand`, `npm run build`.
- Web: `npm run lint`, `npm run test`, `npm run build`; responsive y recorrido con teclado.
- Expo: `npm run test`, `npx tsc --noEmit` y pruebas físicas.
- CI: `node scripts/check-project-consistency.cjs` y control de incremento semver.
- Cambios de esquema: migraciones MySQL/SQL Server, prueba aislada y revisión de permisos de ambos motores.
- UAT: [matriz](docs/UAT_MATRIZ_2026-10-15.json), [puertas de aceptación](docs/BETA_ACEPTACION.json) y responsables institucionales. Un test verde no sustituye UAT.

## Pendientes reales conocidos

- Carga y persistencia de logo en staging [#106](https://github.com/Marcor360/Sistema-Escolar/issues/106).
- Entrega SMTP efectiva a Microsoft 365 y cPanel [#107](https://github.com/Marcor360/Sistema-Escolar/issues/107).
- Aceptación UX/accesibilidad web y Expo [#141](https://github.com/Marcor360/Sistema-Escolar/issues/141).
- Matriz definitiva de permisos de Usuarios y Finanzas [#140](https://github.com/Marcor360/Sistema-Escolar/issues/140).
- Reglamento de evaluación, redondeo, asistencias y formatos de actas [#139](https://github.com/Marcor360/Sistema-Escolar/issues/139).
- Restore aislado, dispositivos físicos y conciliación del ETL legado.

## Documentación útil

- [Arquitectura](docs/ARQUITECTURA.md) · [API](docs/API.md) · [matriz de acceso](docs/MATRIZ_ACCESO.md)
- [Catálogos académicos](docs/CATALOGOS_ACADEMICOS.md) · [materias](docs/MATERIAS_Y_ASIGNACIONES.md) · [temarios y ciclos](docs/TEMARIOS_CICLOS.md)
- [Reglas del piloto](docs/REGLAS_PILOTO.md) · [versionado](docs/VERSIONADO_PR.md) · [operación de producción](docs/OPERACION_PRODUCCION.md)
- [Calificaciones](docs/CALIFICACIONES_CONTEXTO.md) · [preparación de beta](docs/PREPARACION_BETA_1.24.0-beta.1.md)

**Historial:** los informes de versiones anteriores en `docs/` son evidencia histórica; sus fechas y versiones no deben modificarse retroactivamente.
