# Sistema Escolar Multiplataforma

**Versión candidata: `1.24.0-beta.1`** · Estado revisado el 13 de octubre de 2026.

API, portal administrativo/docente y app del alumno para gestión académica y financiera con alcance por plantel. Las versiones de backend, web, móvil, lockfiles y Expo están alineadas. Este README describe una única versión actual; los informes históricos permanecen en `docs/`.

| Componente | Estado actual |
|---|---|
| API y web | Candidata técnica a primera beta funcional; aceptación del piloto pendiente |
| App del alumno | Candidata a beta del alumno; arranque corregido, pruebas físicas pendientes |
| Base de datos | Baseline v1 y siete migraciones incrementales espejo; MySQL 8.4 / SQL Server 2022 probados en CI |
| ETL de legado | Prototipo parcial; no listo para migración institucional general |

Esta candidata incorpora 30 mejoras de UX, conexión, seguridad y fiabilidad. La aceptación de beta requiere un piloto controlado; todavía no se declara primera versión estable de producción. La versión numérica no certifica despliegue, aceptación institucional ni publicación de la app. Consulte las [30 mejoras y condiciones de beta](docs/PREPARACION_BETA_1.24.0-beta.1.md), la [auditoría base](docs/AUDITORIA_ESTADO_1.23.5_2026-10-13.md) y su [inventario de 495 archivos](docs/auditoria/INVENTARIO_1.23.5_2026-10-13.csv).

## Funcionalidad actual

- Identidad, recuperación y cambio de contraseña, sesiones rotativas, roles y acceso limitado por plantel y expediente vigente.
- Planteles, alumnos, docentes, ciclos, grupos, inscripciones, traslados y promoción; importaciones con preview cifrado y confirmación transaccional.
- Materias, actividades, entregas, calificaciones P1–P3 y Final separado, cierre e historial de correcciones; reportes PDF/Excel y analítica con alcance autorizado.
- Calendario, avisos y conducta interna; notificaciones push con cola persistente y contenido genérico.
- Cargos, pagos manuales idempotentes, integración Openpay y correo de cobranza con seguimiento de resultados inciertos.
- Archivos con descargas firmadas y validación de alcance; marca institucional mediante `/api/configuracion/marca`.
- App del alumno para inicio, materias, tareas, calificaciones, perfil y estado de cuenta.

La interfaz incorpora modales con gestión de foco, navegación con iconos, listados adaptables y protección contra respuestas tardías. El inicio móvil conserva información cuando falla parcialmente un servicio; cambiar contraseña exige reautenticación. Materias y tareas se actualizan al cambiar usuario o recuperar foco. Grupos y docentes no conservan detalles obsoletos. Alumnos mantiene los filtros confirmados al paginar y finalizar mutaciones, incluso si cambió la consulta durante la operación. Calendario muestra la baja según creador, plantel y roles combinados, incluyendo la excepción de SUPERADMIN. La candidata añade guías de propósito en web y móvil, confirmaciones de entrega/pago/contraseña, contraste según la marca y bloqueo de envíos duplicados. La aceptación con usuarios sigue pendiente.

## Arquitectura y versiones

| Directorio | Responsabilidad / tecnología resuelta |
|---|---|
| `backend/` | NestJS 11.2.7, TypeORM 0.3.31, TypeScript 5.9.3; API y reglas de negocio |
| `web/` | React 18.3.1, Vite 6.4.3, TypeScript 5.9.3; portal administrativo/docente |
| `mobile/` | Expo 57.0.27, React Native 0.86.3, React 19.2.3, TypeScript 6.0.3; app del alumno |
| `database/` | Baseline, esquema documental y migraciones MySQL / SQL Server |
| `etl/` | Python 3.11; extracción y carga parcial del legado |
| `scripts/` | Consistencia, parches, staging, respaldo y restauración |
| `.github/` | CI y despliegue manual controlado |
| `docs/` | Arquitectura, contratos, operación e informes |

Node 24 es la referencia de CI. Los lockfiles fijan las dependencias JavaScript; el ETL mantiene rangos Python y necesita un lock antes de uso institucional. [Arquitectura](docs/ARQUITECTURA.md) · [API](docs/API.md) · [Matriz de acceso](docs/MATRIZ_ACCESO.md).

## Desarrollo y configuración

Instalar dependencias en cada componente con `npm ci`. Crear configuración local a partir de los ejemplos versionados del componente, completar valores propios y no publicar secretos. No reutilizar credenciales de producción para pruebas. Mantener `DB_SYNC=false`.

```sh
cd backend
npm ci
npm run build
npm run start:dev
```

La API necesita una base previamente preparada conforme a [MIGRACIONES](docs/MIGRACIONES.md). No ejecutar el esquema completo sobre una base existente ni recrearla. Tras compilar, `npm run db:migrate:status` permite consultar su historial; cualquier adopción o aplicación requiere verificar baseline y seguir ese procedimiento.

```sh
cd web
npm ci
npm run dev
```

Configurar la URL de API según los ejemplos del portal. Para móvil:

```sh
cd mobile
npm ci
npm start
```

El dispositivo debe poder alcanzar la API; `localhost` del teléfono no apunta al ordenador. Preview y producción exigen HTTPS. EAS incluye perfiles de desarrollo, preview y producción, pero hacen falta firma, proyecto Expo y credenciales FCM/APNs para distribución y push nativos. La exportación Expo no equivale a un APK/IPA instalado o aprobado.

## Base de datos y seguridad

Los esquemas de ambos motores documentan 39 tablas, con baseline `v1` y siete migraciones incrementales ordenadas posteriores. Su estado en un servidor existente debe consultarse: no se certificó la base productiva. Los últimos PR de interfaz no cambian el esquema. [Procedimiento y manifiestos](docs/MIGRACIONES.md).

La API aplica autorización centralizada, validación de datos, límites de solicitudes, contraseñas con hash, acceso de corta duración y refresh rotativo con revocación. El portal usa refresh en cookie HttpOnly/SameSite Strict y acceso en memoria; la app usa SecureStore. Producción exige configuración TLS y secretos adecuados. El portal dispone de CSP y cabeceras de seguridad. Uploads no se publican como carpeta estática; las descargas verifican firma, sesión y permisos. La configuración y operación siguen siendo responsabilidad del despliegue.

La auditoría de dependencias no informó vulnerabilidades conocidas en npm ni en la resolución Python revisada. Esto no constituye certificación de seguridad. Los uploads no cuentan con antivirus ni cuotas agregadas; se requieren políticas de conservación y aceptación institucional. Los parches de dependencias incluidas localmente necesitan mantenimiento.

## Validación y límites actuales

La candidata incorpora 191 pruebas unitarias de backend, 80 web, 58 móviles y 11 pruebas Node de configuración/auditoría. El ETL conserva sus siete pruebas. La integración y compilación se exigen en CI antes de publicar cada commit. CI ejecutó 73 pruebas de integración en cada motor y verificaciones de navegador/responsive entre 320 y 3840 px. Tipos, builds y exportación Android Expo aprobaron. Backend lint tiene cero errores y 527 advertencias que deben reducirse. [Evidencia y alcance de la candidata](docs/PREPARACION_BETA_1.24.0-beta.1.md#validación).

```sh
# Desde backend/
npm run lint
npm run typecheck
npm test -- --runInBand
node ../scripts/check-project-consistency.cjs

# Desde web/
npm run lint
npm test
npm run build

# Desde mobile/
npm test
npx tsc --noEmit

# Desde etl/
python -m unittest discover -s tests
```

Las integraciones requieren bases aisladas configuradas para pruebas. Los ocho jobs de la [CI del código integrado](https://github.com/Marcor360/Sistema-Escolar/actions/runs/38442392681) aprobaron; revisar también la CI del commit que se vaya a desplegar.

Antes del piloto:

- Validar físicamente el arranque móvil ante almacenamiento fallido: el cargador ya tolera lectura, borrado, escritura y red fallidas con marca predeterminada y regresiones automatizadas.
- Antes de migrar legado, completar pipelines y mapeo del ETL y exigir TLS verificado; hoy sólo planteles/alumnos están implementados.
- Probar builds firmados en Android/iOS físicos, push, permisos, reconexión y cambio de cuenta.
- Certificar staging, SMTP/Openpay, permisos, cierre/promoción, copias y restauración con responsables institucionales.

La edición de eventos, una biblioteca general de archivos y una cola académica offline no forman parte de la implementación actual. No se certificaron VPS, bases reales, proveedores ni tiendas de aplicaciones durante este barrido.

## Documentación operativa

- [Preparación de beta, guía de uso y 30 mejoras](docs/PREPARACION_BETA_1.24.0-beta.1.md)
- [Auditoría base e inventario](docs/AUDITORIA_ESTADO_1.23.5_2026-10-13.md)
- [Reglas del piloto](docs/REGLAS_PILOTO.md)
- [Migraciones y protección de datos existentes](docs/MIGRACIONES.md)
- [Operación de producción](docs/OPERACION_PRODUCCION.md)
- [Staging Windows / IIS](docs/STAGING_WINDOWS_IIS.md)
- [ETL](etl/README.md)
- [Plan de UX, seguridad y piloto](docs/PLAN_UX_SEGURIDAD_PILOTO_2026-10-13.md)
