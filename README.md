# Sistema Escolar Multiplataforma (MVP)

> Portal web administrativo/docente, app móvil del alumno y API para gestión académica y financiera. El código cubre los flujos principales del MVP; todavía no hay certificación de piloto institucional ni despliegue productivo.

**Versión candidata: `1.17.0` · Commit: `1.17.0` · 8 de octubre de 2026.** Backend, web, móvil y Expo declaran la misma versión. La CI del SHA publicado debe comprobarse en [GitHub Actions](https://github.com/Marcor360/Sistema-Escolar/actions/workflows/ci.yml). El piloto requiere todavía certificación sobre el servidor y dispositivos reales.

## Refactor y configuración 1.17.0

- Fachada académica con servicios de ciclos, materias, grupos e inscripciones; endpoints y DTO públicos conservados.
- Suite HTTP separada en once dominios con bootstrap común y el orden de regresiones conservado.
- Paneles de cargos, pagos y adeudos extraídos de la página de Finanzas; idempotencia y coordinación permanecen en la página.
- Validación central de entorno antes de construir providers, sin defaults implícitos de credenciales/base de datos.

Detalle: [REFACTOR_1.17.0.md](docs/REFACTOR_1.17.0.md).

## Correcciones de seguridad 1.16.1

- Política central por operación: Finanzas no amplía acceso académico de maestros; la analítica entrega capacidades académicas y financieras por separado.
- Calendario exclusivo de alumno, maestro, administrativo y superadmin; Finanzas solo no tiene acceso.
- Promoción bloquea ciclos, plantel y grupos en orden determinista y revalida contexto antes de inscribir.
- Pruebas de seis combinaciones de roles y promoción frente a desactivación concurrente en MySQL/SQL Server.

Detalle: [CORRECCIONES_1.16.1.md](docs/CORRECCIONES_1.16.1.md).

## Cambios incluidos en la versión 1.16.0

- **Origen financiero:** cargos, pagos y órdenes conservan el plantel de origen después de transferir al alumno. Consultas, permisos, reportes, conciliación y selectores financieros usan ese origen.
- **Histórico académico:** analítica de ciclos cerrados conserva materias/grupos retirados y participantes de baja; distingue participación histórica de inscripción vigente. Agregados en SQL con la regla oficial P1-P3 centralizada.
- **Push durable:** la notificación conserva un marcador de cola pendiente; se recupera tras fallos sin duplicar envíos por dispositivo.
- **Cobranza:** seguimiento por destinatario, deduplicación diaria del mismo saldo, reintentos limitados ante rechazo temporal, estado INCIERTO ante timeout y reintento manual con motivo/confirmación.
- **Formularios:** motivos y títulos editables conservan datos tras errores; diálogos accesibles con foco y controles asociados a labels.
- **Verificación ampliada:** recorridos académicos/financieros en Chromium con API/DB reales y carga controlada de 100 alumnos, 900 notas y capturas simultáneas. Nuevo job obligatorio `web-e2e`.
- **Migración:** `migracion_integridad_operativa.sql` incremental espejo en MySQL/SQL Server. Baseline intacto y `DB_SYNC=false`.

Detalle, inventario y límites: [CORRECCIONES_1.16.0.md](docs/CORRECCIONES_1.16.0.md). El ETL certweb completo requiere el esquema real sanitizado; no se inventan mapeos ni se declara el piloto listo.

## Base funcional incluida desde 1.15.0

- **Ampliación operativa:** ciclos en preparación con activación/cierre explícitos, promoción seleccionada, importación CSV/XLSX con validación por fila y confirmación atómica, reactivación controlada y gestión de cuentas de personal.
- **Push móvil:** registro por dispositivo y sesión, permisos voluntarios, reintentos, recibos y aviso genérico sin datos académicos en pantalla bloqueada. Requiere configuración EAS/FCM/APNs y prueba física; queda deshabilitado por defecto en backend.
- **Conducta e incidencias:** registro, seguimiento, cierre/anulación y bitácora exclusivamente internos; control escolar por plantel y docentes por sus grupos. No se publica al alumno ni se envía por push.
- **Analítica:** captura y faltantes P1-P3, promedio oficial, aprobación orientativa y entregas vencidas por clase/ciclo/plantel; facturación, pagos aplicados y saldo solo para roles autorizados.
- **Política financiera:** conceptos editables, recargos desactivados por defecto hasta configuración explícita y beca/descuento como reducción del cargo.
- **Audit móvil:** cero vulnerabilidades y sin excepciones mediante parches locales revisables de herramientas Expo/Metro, con pruebas de regresión y política de actualización a correcciones oficiales.
- **Baseline técnico:** metadata TypeORM compatible con MySQL/SQL Server, TypeScript estricto, `DB_SYNC=false`, paridad física y eliminación de `.pyc` trackeados.
- **Identidad y permisos:** altas por expediente, personal con plantel, cambio inicial obligatorio, baja/egreso/transferencia explícitos y coherentes; baja docente con clases pendientes de reasignación.
- **Sesiones:** acceso de 15 minutos y refresh rotativo por dispositivo, revocación inmediata, cookie HttpOnly en web y SecureStore en móvil. El bearer web permanece en memoria.
- **Academia y calendario:** contexto vigente, inscripción única por ciclo bajo transacción, ciclo de grupo inmutable, validación de entidades activas y eventos aislados por grupo con intervalos de consulta.
- **Evaluación y reportes:** actividades separadas de evaluación oficial; motivo al corregir, cierre sin faltantes, promedio backend P1-P3; boleta por ciclo/inscripción restringida a alumno/control escolar; Excel incluye inscritos sin nota.
- **Operación web:** edición de alumnos/docentes, transferencia, egreso, historial, boleta, planteles docentes y corrección de grupos, materias e inscripciones. Selectores con búsqueda API paginada.
- **Finanzas:** cancelación de cargo y anulación de pago manual auditables, conciliación, previews por plantel y confirmación de operaciones masivas, adeudos paginados y pagos con cargo obligatorio.
- **Móvil y archivos:** sesión renovable, fechas de última actualización en consultas, estado real de pagos, prohibición de reentrega calificada y eliminación del archivo sustituido tras commit; validación de firmas de archivos.
- **Operación:** proxy local confiable para IIS, request ID sin datos personales en logs, liveness/readiness con verificación de migraciones, APK interno EAS preview y herramienta de carga para consultas.
- **Migraciones reales:** `migracion_operacion_ampliada.sql` espejo añade estados de ciclo, política de recargos, incidencias/seguimientos, bitácora académica, dispositivos/envíos push y cola de limpieza de archivos. `migracion_sesiones_rotativas.sql` espejo MySQL/SQL Server añade sesiones y cambio inicial de contraseña. El baseline v1 permanece intacto.

Consulta [ampliación y verificaciones](docs/AMPLIACION_1.15.0.md), [correcciones anteriores](docs/CORRECCIONES_1.15.0.md) y [reglas del piloto](docs/REGLAS_PILOTO.md).

Consulta también el [estado de implementación](docs/ESTADO_IMPLEMENTACION.md). Ya existe un servidor; la [guía de publicación](docs/PUBLICAR_SERVIDOR_EXISTENTE.md) explica los datos y pasos necesarios para configurarlo y certificarlo. Esta versión no declara el piloto listo.

---

## 📖 ¿Qué es este proyecto?

Es un **Sistema de Gestión Escolar (ERP educativo)** diseñado para manejar las operaciones diarias completas de una institución educativa. Permite gestionar desde la admisión de alumnos, gestión académica (grupos, materias, calificaciones), hasta finanzas (cobranza, pagos, adeudos) en una sola plataforma multiplataforma.

### 🎯 Propósito Principal

Digitalizar y automatizar los procesos educativos con:
- **Gestión académica**: grupos, materias, docentes, alumnos, actividades, entregas, calificaciones
- **Gestión administrativa**: planteles, usuarios, roles, personal
- **Gestión financiera**: cargos, pagos, adeudos, cobranza, becas, descuentos
- **Herramientas pedagógicas**: actividades, materiales didácticos, tareas con entrega de archivos

---

## 🛠️ Tecnologías Utilizadas

### Backend (API RESTful)
| Tecnología | Versión | Función |
|------------|---------|---------|
| **Node.js** | 24 LTS | Runtime JavaScript |
| **NestJS** | 11 | Framework API con arquitectura modular y dependencias inyectadas |
| **TypeORM** | - | ORM para gestión de base de datos con soporte MySQL/SQL Server |
| **JWT** | passport-jwt | Autenticación con tokens firmados y expiración diferenciada por portal |
| **Multer** | - | Manejo de archivos (materiales, entregas) con validación |
| **Helmet** | - | Seguridad en encabezados HTTP |
| **Throttler** | @nestjs/throttler | Rate limiting (120 req/min global, 5/min en login) |
| **Swagger** | @nestjs/swagger | Documentación API interactiva |

### Frontend Web
| Tecnología | Versión | Función |
|------------|---------|---------|
| **React** | 18 | Framework UI con hooks modernos |
| **Vite** | - | Build tool optimizado para desarrollo rápido |
| **React Router** | - | Navegación SPA con code splitting |
| **TypeScript** | - | Tipado estático y seguridad de código |

### Frontend Móvil
| Tecnología | Versión | Función |
|------------|---------|---------|
| **React Native** | 0.86.3 | App móvil para alumnos |
| **Expo** | SDK 57 | Desarrollo y exportación de bundles Android/iOS; build firmado pendiente |

### Base de Datos
| Motor | Características |
|-------|-----------------|
| **MySQL 8** | Motor predeterminado; integración HTTP validada en CI con MySQL 8.4 y `DB_SYNC=false` |
| **SQL Server 2019+** | Esquema espejo; integración HTTP validada en CI con SQL Server 2022 y `DB_SYNC=false` |

### ETL (Migración)
| Tecnología | Función |
|------------|---------|
| **Python 3.11+** | Pipeline parcial de migración desde certweb (*strangler fig*) |
| **pymssql / mysql-connector / pyodbc** | Lectura de certweb y carga al destino MySQL o SQL Server |

---

## 🏗️ Visualización de la Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENTES (Frontend)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │   Portal WEB  │  │   App MÓVIL  │  │   Openpay (Webhook)│   │
│  │  React/Vite   │  │ React Native │  │      Openpay       │   │
│  └──────────────┘  └──────────────┘  └────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTPS/JSON
┌─────────────────────────────────────────────────────────────────┐
│                    API BACKEND (NestJS)                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  • Autenticación JWT (passport-jwt)                      │   │
│  │  • Guard de roles (@Roles('FINANZAS'), etc.)             │   │
│  │  • Rate limiting global y por endpoint                   │   │
│  │  • Validación con class-validator                        │   │
│  │  • Interceptor BitacoraActividad                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↓ TypeORM                          │
┌─────────────────────────────────────────────────────────────────┐
│              BASE DE DATOS (MySQL / SQL Server)                  │
│  • Entidades TypeORM con nombres snake_case                     │
│  • Esquema espejo MySQL ↔ SQL Server                           │
│  • Migraciones incrementales MySQL y SQL Server                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICIOS EXTERNOS                           │
│  • Openpay (BBVA) — Pasarela de pagos                          │
│  • SMTP — Correos (cobranza, recuperación contraseña)          │
│  • certweb — Base legacy para migración ETL                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⏱️ Tiempo de Desarrollo Estimado

Las duraciones siguientes son la estimación original del alcance contractual; no
representan el progreso ni el esfuerzo pendiente actual. Consulta [Estado de implementación](docs/ESTADO_IMPLEMENTACION.md).

| Fase | Duración | Descripción |
|------|----------|-------------|
| **Fase 1: Autenticación y Roles** | 2-3 días | JWT, guard de roles, portal diferenciado WEB/MÓVIL |
| **Fase 2: Gestión de Planteles** | 2-3 días | CRUD planteles, alcance por usuario, director |
| **Fase 3: Gestión Académica** | 5-7 días | Ciclos, materias, grupos, inscripciones, grupo-materias |
| **Fase 4: Docentes y Alumnos** | 3-4 días | CRUD docentes, creación alumnos con usuario asociado |
| **Fase 5: Actividades y Entregas** | 4-5 días | Creación actividades, subida materiales, entregas archivos |
| **Fase 6: Calificaciones** | 2-3 días | Captura masiva, promedios, reportes PDF/Excel |
| **Fase 7: Finanzas** | 7-10 días | Conceptos, cargos, pagos, Openpay, adeudos, cobranza |
| **Fase 8: Calendario y Notificaciones** | 2-3 días | Eventos, difusión por rol, correos |
| **Fase 9: Archivos y Descargas** | 1-2 días | Enlaces firmados de 5 min, streaming seguro |
| **Fase 10: Reportes** | 2-3 días | KPIs, boletas PDF, Excel calificaciones/adeudos |
| **Fase 11: Configuración de Marca** | 1 día | Logo, colores institucionales dinámicos |
| **Fase 12: ETL y Migración** | 5-7 días | Pipeline Python certweb → Sistema Escolar |
| **Estimación original** | **~40-50 días** | **~8-10 semanas para el alcance inicial** |

---

## 🔗 Integraciones Externas

### 1. **Openpay**
```typescript
// backend/src/finanzas/openpay.service.ts
- Crea cargos con redirección a pasarela segura
- Webhook confirma pagos: charge.succeeded/failed/cancelled
- Transaction.expired para pagos caducados
- Basic Auth exigida para el webhook en producción (OPENPAY_WEBHOOK_USER/PASS)
```

### 2. **SMTP (Correos)**
```typescript
// backend/src/notificaciones/notificaciones.service.ts
- Envío de correos de cobranza (plantilla configurable)
- Recuperación de contraseña con token por email
- Avisos de pago completado
```

### 3. **certweb (Base Legacy)**
```python
# etl/etl/run.py
- Migración inicial desde sistema certweb anterior
- Estrategia *strangler fig* (Mes 6 del contrato)
- Upserts parciales por legacy_id de planteles y alumnos; faltan otras entidades
- Modo --dry-run para pruebas sin escribir datos
```

### 4. **Pasarela de Pagos**
| Proveedor | Estado | Uso |
|-----------|--------|-----|
| Openpay | Código integrado; sandbox pendiente de certificar | Cobranza online con redirección |
| Stripe | ❌ No incluido | - |
| MercadoPago | ❌ No incluido | - |

---

## 📂 Estructura del Código

### Backend (NestJS)

```
backend/
├── src/
│   ├── app.module.ts              # Módulo principal con imports de todos los módulos
│   ├── main.ts                    # Punto de entrada, configuración global
│   │
│   ├── auth/                      # Autenticación y autorización
│   │   ├── auth.controller.ts     # Login, forgot-password, reset, cambiar-password
│   │   ├── auth.service.ts        # Lógica JWT, hash tokens, validación
│   │   ├── jwt.strategy.ts        # Passport JWT strategy
│   │   └── dto/auth.dto.ts        # DTOs de autenticación
│   │
│   ├── usuarios/                  # Gestión de usuarios y roles
│   │   ├── usuarios.controller.ts # CRUD usuarios, listado paginado
│   │   ├── usuarios.service.ts    # Lógica con ScopeService para alcance
│   │   └── usuarios.module.ts     # Módulo con TypeORM entities
│   │
│   ├── planteles/                 # Gestión de planteles
│   │   ├── planteles.controller.ts
│   │   ├── planteles.service.ts   # CRUD + asignación personal/director
│   │   ├── scope.service.ts       # Validación de alcance por usuario
│   │   └── planteles.module.ts
│   │
│   ├── academico/                 # Gestión académica (ciclos, materias, grupos)
│   │   ├── academico.controller.ts
│   │   ├── academico.service.ts   # CRUD + asignación docente/materia
│   │   └── academico.module.ts
│   │
│   ├── alumnos/                   # Gestión de alumnos
│   │   ├── alumnos.controller.ts  # CRUD + perfil propio (ALUMNO)
│   │   ├── alumnos.service.ts    # Lógica con ScopeService
│   │   └── alumnos.module.ts
│   │
│   ├── docentes/                  # Gestión de docentes
│   │   ├── docentes.controller.ts
│   │   ├── docentes.service.ts
│   │   └── docentes.module.ts
│   │
│   ├── actividades/               # Actividades y entregas
│   │   ├── actividades.controller.ts
│   │   ├── actividades.service.ts # CRUD + subida materiales + calificar
│   │   └── actividades.module.ts
│   │
│   ├── calificaciones/            # Calificaciones
│   │   ├── calificaciones.controller.ts
│   │   ├── calificaciones.service.ts # Captura, cierre de periodo e historial
│   │   └── calificaciones.module.ts
│   │
│   ├── calendario/                # Calendario académico
│   │   ├── calendario.controller.ts
│   │   ├── calendario.service.ts  # CRUD eventos + alcance por plantel
│   │   └── calendario.module.ts
│   │
│   ├── notificaciones/            # Notificaciones in-app y correos
│   │   ├── notificaciones.controller.ts
│   │   ├── notificaciones.service.ts
│   │   └── notificaciones.module.ts
│   │
│   ├── finanzas/                  # Módulo financiero (SOLID/SRP)
│   │   ├── finanzas.controller.ts # Orquesta todos los servicios financieros
│   │   ├── finanzas.module.ts
│   │   ├── conceptos.service.ts   # Catálogo de conceptos pago
│   │   ├── cargos.service.ts      # Cuentas por cobrar (cargos, saldos, adeudos)
│   │   ├── pagos.service.ts       # Pagos manuales y de pasarela
│   │   ├── ordenes.service.ts     # Órdenes Openpay + webhook
│   │   ├── cobranza.service.ts    # Avisos por correo + notificación
│   │   ├── bitacora-financiera.service.ts # Bitácora de movimientos
│   │   └── openpay.service.ts     # Integración con pasarela BBVA
│   │
│   ├── archivos/                  # Manejo seguro de archivos
│   │   ├── archivos.controller.ts # Enlaces firmados + streaming
│   │   ├── archivos.service.ts    # Firma JWT, validación, descarga
│   │   └── archivos.module.ts
│   │
│   ├── reportes/                  # Generación de reportes
│   │   ├── reportes.controller.ts # KPIs, boletas PDF, Excel
│   │   ├── reportes.service.ts    # PDF boleta, Excel calificaciones/adeudos
│   │   └── reportes.module.ts
│   │
│   ├── configuracion/             # Configuración de marca institucional
│   │   ├── configuracion.controller.ts
│   │   ├── configuracion.service.ts # Logo, colores dinámicos
│   │   └── configuracion.module.ts
│   │
│   ├── entities/                  # Definiciones TypeORM (28 entidades)
│   │   ├── usuario.entity.ts      # Usuario con roles ManyToMany
│   │   ├── alumno.entity.ts       # Alumno con inscripción y plantel
│   │   ├── docente.entity.ts      # Docente vinculado a usuario
│   │   ├── plantel.entity.ts      # Plantel con director y alcance
│   │   ├── grupo.entity.ts        # Grupo con ciclo, grado, turno
│   │   ├── materia.entity.ts      # Materia del catálogo académico
│   │   ├── grupo-materia.entity.ts # Eje central: grupo+materia+docente
│   │   ├── inscripcion.entity.ts  # Vinculación alumno-grupo
│   │   ├── actividad.entity.ts    # Actividad con fecha límite
│   │   ├── entrega.entity.ts      # Entrega de alumno a actividad
│   │   ├── material.entity.ts     # Material didáctico
│   │   ├── calificacion.entity.ts # Calificación (parcial 0=final)
│   │   ├── evento-calendario.entity.ts # Evento académico
│   │   ├── concepto-pago.entity.ts # Concepto financiero
│   │   ├── cargo.entity.ts        # Cargo por alumno+concepto+periodo
│   │   ├── pago.entity.ts         # Pago con referencia y monto
│   │   ├── orden-pago.entity.ts   # Orden Openpay
│   │   ├── notificacion.entity.ts # Notificación in-app
│   │   ├── bitacora-financiera.entity.ts # Movimiento financiero
│   │   ├── bitacora-actividad.entity.ts # Registro de actividad
│   │   ├── password-reset-token.entity.ts # Token recuperación (hash)
│   │   ├── rol.entity.ts          # Rol con clave y nombre
│   │   ├── usuario-plantel.entity.ts # Asignación usuario-planteles
│   │   └── configuracion-marca.entity.ts # Marca institucional
│   │
│   ├── config/                    # Configuración TypeORM
│   │   └── typeorm.config.ts      # Conexión MySQL/SQL Server
│   │
│   ├── common/                    # Componentes globales
│   │   ├── bitacora.interceptor.ts # Interceptor para registrar actividad
│   │   ├── jwt-auth.guard.ts      # Guard de autenticación JWT
│   │   ├── roles.guard.ts         # Guard de autorización por roles
│   │   ├── current-user.decorator.ts # Decorador @CurrentUser()
│   │   ├── paginacion.dto.ts      # DTO estándar de paginación
│   │   └── upload.config.ts       # Configuración Multer
│   │
│   ├── seed/                      # Datos de demostración
│   │   └── seed.ts                # Idempotente, exclusivo desarrollo
│   │
│   └── archivos/                  # Archivos estáticos (logo público)
│       └── logo-publico.controller.ts
│
├── package.json                   # Dependencias y scripts
├── tsconfig.json                  # Configuración TypeScript
├── test/tsconfig.json             # Typecheck de integración HTTP
├── nest-cli.json                  # Configuración NestJS
├── jest.config.cjs                # Configuración tests
└── .env.example                   # Plantilla variables de entorno
```

Las bases y migraciones están en `database/mysql/` y `database/sqlserver/`, fuera de `backend/`. `schema.sql` sirve solo para documentar la paridad; el runner usa baselines versionados y migraciones incrementales.

### Frontend Web (React/Vite)

```
web/
├── src/
│   ├── api/                       # Client HTTP con TypeScript
│   │   └── client.ts              # Funciones abrirArchivo(), mensajeDeError()
│   │
│   ├── auth/                      # Autenticación y protección de rutas
│   │   ├── AuthContext.tsx        # Contexto para token JWT
│   │   └── RutaProtegida.tsx      # Wrapper con @Roles() en servidor
│   │
│   ├── layout/                    # Estructura base
│   │   └── Shell.tsx              # Layout principal con navegación
│   │
│   ├── components/                # Componentes reutilizables
│   │   ├── Campana.tsx            # Notificaciones in-app
│   │   ├── Cargando.tsx           # Spinner de carga
│   │   ├── Encabezado.tsx         # Header con logo dinámico
│   │   └── Paginador.tsx          # Componente paginación estándar
│   │
│   ├── hooks/                     # Hooks personalizados
│   │   └── useDatos.ts            # Hook genérico: carga/error/reintento
│   │
│   ├── utils/                     # Utilidades
│   │   └── formato.ts             # Formateo moneda, fecha (locale es-MX)
│   │
│   ├── marca/                     # Configuración de marca
│   │   └── MarcaContext.tsx       # Contexto con colores/logo dinámicos
│   │
│   ├── pages/                     # Páginas por módulo
│   │   ├── Login.tsx              # Login diferenciado WEB/MÓVIL
│   │   ├── Dashboard.tsx          # Panel resumen con KPIs
│   │   ├── Planteles.tsx          # Gestión de planteles
│   │   ├── Usuarios.tsx           # CRUD usuarios (SUPERADMIN)
│   │   ├── Docentes.tsx           # CRUD docentes (ADMINISTRATIVO)
│   │   ├── Alumnos.tsx            # Listado y gestión alumnos
│   │   ├── Materias.tsx           # Catálogo materias
│   │   ├── Grupos.tsx             # Gestión grupos e inscripciones
│   │   ├── Maestro.tsx            # Panel maestro (mis-grupos)
│   │   ├── Calificaciones.tsx     # Tabla calificaciones + captura masiva
│   │   ├── Calendario.tsx         # Eventos académicos
│   │   ├── Avisos.tsx             # Difusión de avisos
│   │   ├── Finanzas.tsx           # Cargos, pagos, estado cuenta
│   │   ├── Cuenta.tsx             # Estado de cuenta ALUMNO
│   │   ├── PagoCompletado.tsx     # Confirmación pago Openpay
│   │   └── Configuracion.tsx      # Logo y colores marca
│   │
│   ├── styles.css                 # Estilos globales
│   └── App.tsx                    # Componente raíz con routing
│
├── index.html                     # Entry point HTML
├── package.json                   # Dependencias y scripts
├── tsconfig.json                  # Configuración TypeScript
├── vite.config.ts                 # Configuración Vite (code splitting)
└── .eslintrc.cjs                  # Reglas ESLint
```

### Frontend Móvil (React Native/Expo)

```
mobile/
├── src/
│   ├── api/                       # Client HTTP móvil
│   │   └── client.ts              # Similar al web con EXPO_PUBLIC_API_URL
│   │
│   ├── sesion.tsx                 # Gestión de sesión JWT móvil
│   ├── marca.tsx                  # Marca dinámica (colores/logo)
│   ├── theme.ts                   # Tema visual móvil
│   └── formato.ts                 # Formateo moneda/fecha móvil
│
│   ├── screens/                   # Pantallas principales
│   │   ├── Login.tsx              # Login ALUMNO exclusivo
│   │   ├── Inicio.tsx             # Resumen (tareas, saldo, avisos)
│   │   ├── Materias.tsx           # Listado materias con calificaciones
│   │   ├── Tareas.tsx             # Actividades pendientes y entregas
│   │   ├── Calificaciones.tsx     # Tabla de calificaciones por materia
│   │   ├── EstadoCuenta.tsx       # Estado de cuenta propio del alumno
│   │   ├── Perfil.tsx             # Datos personales + cambio contraseña
│   │   └── comunes.tsx            # Componentes reutilizables
│   │
│
├── App.tsx                        # Componente raíz con navegación
│
├── app.json                       # Configuración Expo
├── package.json                   # Dependencias y scripts
└── tsconfig.json                  # Configuración TypeScript
```

### ETL (Migración Python)

```
etl/
├── etl/
│   ├── __init__.py
│   ├── config.py                  # Configuración de conexión DB
│   ├── extract.py                 # Extracción desde certweb
│   ├── load.py                    # Carga idempotente con legacy_id
│   ├── transform.py               # Limpieza y transformación datos
│   └── run.py                     # Orquestación (--dry-run por defecto)
│
├── requirements.txt               # Dependencias Python
└── README.md                      # Documentación ETL
```

---

## 🧭 Navegación del Sistema

### Flujo de Autenticación

```
1. Usuario ingresa a portal (WEB o MÓVIL)
   ↓
2. Frontend envía x-portal: WEB|MOVIL en header
   ↓
3. Backend valida roles permitidos por portal:
   - WEB: SUPERADMIN, ADMINISTRATIVO, FINANZAS, MAESTRO
   - MÓVIL: ALUMNO (excluyente)
   ↓
4. Se emite access token de 15 minutos y refresh rotativo por sesión (máximo 30 días).
   ↓
5. Web guarda access en memoria y refresh en cookie HttpOnly; móvil usa SecureStore.
6. Ambos consultan GET /auth/me y renuevan al expirar. POST /auth/logout revoca ese dispositivo.
7. La baja y el cambio de contraseña/roles invalidan todas las sesiones por versión.
```

La migración de sesiones requiere desplegar API, web y móvil coordinados y volver a iniciar sesión. Las reglas están en [REGLAS_PILOTO.md](docs/REGLAS_PILOTO.md).

### Flujo de Gestión Académica

```
1. ADMINISTRATIVO crea Ciclo Escolar → Materia → Grupo
2. Asigna Materia a Grupo + Docente (GrupoMateria)
3. Inscribe Alumnos al Grupo
4. Maestro ve "Mis Grupos" (solo sus asignaciones)
5. Maestro crea Actividades y sube Materiales
6. Alumno entrega trabajos con archivos ≤5MB
7. Maestro califica entregas y captura parciales; administración puede cerrar y reabrir periodos
8. Sistema calcula promedios automáticamente
9. Generación de boletas PDF y reportes Excel
```

### Flujo Financiero

```
1. FINANZAS configura Conceptos (inscripción, colegiatura, etc.)
2. Genera Cargos masivos por ciclo+periodo para alumnos inscritos
3. Aplica recargos a cargos vencidos (una vez por cargo)
4. Alumno crea Orden de Pago → Redirección Openpay
5. Webhook confirma pago → Recalcula cargo → Notifica alumno
6. FINANZAS registra pagos manuales (efectivo/transferencia) con clave de idempotencia
7. Genera avisos de cobranza por correo
8. Alumno ve estado de cuenta propio con historial
```

### Flujo de Archivos Seguros

```
1. Maestro sube material o alumno entrega trabajo (≤5MB)
2. Archivo guardado en uploads/ con nombre UUID
3. Para descarga:
   - Cliente pide GET /archivos/materiales/:id/enlace
   - Backend valida sesión y devuelve URL firmada (5 min)
   - Cliente abre URL con token t=xxx
   - Streaming valida firma, expiración y pertenencia
4. Nunca se sirve como estático público
```

---

## 🔐 Seguridad Implementada

| Característica | Descripción |
|---------------|-------------|
| **Sesiones rotativas** | Access de 15 minutos, refresh por dispositivo y detección de reutilización |
| **Revocación** | Logout de dispositivo; baja/cambio de contraseña o roles incrementa `session_version` |
| **Tokens firmados para archivos** | 5 minutos de vida útil, validación en streaming |
| **Hash SHA256 para tokens de recuperación** | Solo persiste el hash, no el token en claro |
| **Webhook Openpay autenticado en producción** | `OPENPAY_WEBHOOK_USER/PASS` obligatorios al activar producción |
| **Rate limiting** | 120 req/min global, 5/min en login/recuperación |
| **Encabezados Helmet** | Seguridad HTTP estándar |
| **CORS restringible** | `CORS_ORIGINS` en producción |
| **Swagger apagado en producción** | Exige `JWT_SECRET` real con `NODE_ENV=production` |
| **Contraseñas bcrypt** | Hash seguro de contraseñas |
| **Validación whitelist** | `class-validator` con `whitelist: true` |
| **Permisos por rol** | Validación en API y rutas del portal |
| **Portal IIS** | CSP, HSTS, protección contra iframes y Permissions Policy en `web.config` |

---

**Endurecimiento pendiente:** resolver la excepción `strictPropertyInitialization: false` de DTO/entidades y certificar la CSP con los dominios finales. El backend ya activa `strict: true` con esa excepción; el lint rechaza `any` en código de producción y advierte sobre los dobles de prueba que aún lo usan.

---

## 📊 Reportes Generados

| Reporte | Formato | Descripción |
|---------|---------|-------------|
| **KPIs Dashboard** | JSON | Contadores para panel resumen |
| **Boleta Alumno** | PDF | Parciales, final y promedios por materia |
| **Calificaciones Clase** | Excel | Concentrado grupo-materia (parciales, final, promedio) |
| **Adeudos** | Excel | Cargos con saldo pendiente por plantel |

---

## 🚀 Comandos Útiles

Usa **Node.js 24** para instalar dependencias, ejecutar pruebas y compilar los tres proyectos. La CI usa esa versión. Los comandos siguientes se ejecutan desde cada carpeta indicada; `npm ci` reproduce el lockfile.

### Backend
```bash
cd backend
npm ci                         # Instalar dependencias del lockfile
npm run start:dev              # Desarrollo (http://localhost:3000/api)
ALLOW_DEV_SEED=true npm run seed  # Solo local: requiere 5 contraseñas distintas de 16+ caracteres en backend/.env
npm run lint                   # Validar código
npm run typecheck              # Verificar src/ y test/ (integración HTTP)
npm test                       # Ejecutar tests Jest
npm run build                  # Compilar API
npm run test:integration       # Flujos HTTP sobre baseline en base escolar_integration_* aislada (DB_SYNC=false)
```

### Frontend Web
```bash
cd web
npm ci                         # Instalar dependencias del lockfile
npm run dev                    # Desarrollo (http://localhost:5173)
npm run build                  # Build de producción
npm run lint                   # Validar código
npm test                       # Pruebas web
```

### Frontend Móvil
```bash
cd mobile
npm ci                         # Instalar dependencias del lockfile
npx expo start                 # Iniciar Expo
npx tsc --noEmit               # Verificar TypeScript
npm test                       # Pruebas móviles
npx expo-doctor                # Compatibilidad de Expo SDK 57
npx expo export --platform android  # Bundle JS; no es un APK firmado
```

### Base de Datos
```bash
# Copia .env.docker.example a .env y cambia las contraseñas de desarrollo.
# Los puertos publicados por Compose quedan enlazados a 127.0.0.1.
cp .env.docker.example .env

# MySQL en Docker
docker compose up -d mysql

# SQL Server en Docker (alternativa)
docker compose --profile mssql up -d sqlserver

# Compila, revisa y aplica las migraciones pendientes con DB_SYNC=false.
# npm run build; npm run db:migrate:status; npm run db:migrate
# Consulta docs/MIGRACIONES.md; adopta un historial existente solo tras auditarlo.
```

---

## 🖥️ Staging en Windows Server

El repositorio incluye scripts de staging para Windows Server 2019 con IIS, NestJS como servicio NSSM y MySQL 8.4. **El VPS, la actualización de una copia institucional y una restauración real todavía requieren validación.** La guía operativa está en [Staging en Windows e IIS](docs/STAGING_WINDOWS_IIS.md).

Antes del primer despliegue, prepara DNS y el certificado HTTPS, MySQL con TLS, una base `escolar_staging` nueva y separada, y los archivos protegidos `C:\SistemaEscolar\config\backend.env` y `C:\SistemaEscolar\config\backup.env`. Usa [la plantilla del backend](backend/.env.staging.example) y [la del respaldo](scripts/windows/backup.env.example). `BACKUP_DB_USER` debe ser distinto de `DB_USER`. Instala el baseline y adopta su historial solo en una base nueva, siguiendo [Migraciones](docs/MIGRACIONES.md); nunca ejecutes `schema.sql` completo ni habilites `DB_SYNC=true` en staging.

Desde una consola administrativa en el servidor, con Node 24, IIS, URL Rewrite, ARR, NSSM y el certificado ya instalados:

```powershell
$credential = Get-Credential '.\svc_escolar_api'
.\scripts\windows\Initialize-Staging.ps1 -Version '1.15.0' -Source 'C:\Builds\sistema-escolar-mvp' -ServiceCredential $credential -ApiBaseUrl 'https://api-staging.dominio.mx/api'
.\scripts\windows\Configure-IIS-Staging.ps1 -PortalHost 'sistema-staging.dominio.mx' -ApiHost 'api-staging.dominio.mx' -CertificateThumbprint '<huella-del-certificado>'
Start-Service SistemaEscolarApi
Invoke-WebRequest 'https://api-staging.dominio.mx/api/health'
```

El bootstrap crea o valida una cuenta local dedicada y le da acceso al código, al archivo de entorno y a las carpetas de uploads y logs. La API escucha en `127.0.0.1:3000`; IIS sirve React y hace proxy HTTPS hacia la API. Los uploads permanecen fuera de las releases en `C:\SistemaEscolar\data\uploads` y solo se descargan mediante enlaces firmados.

Para versiones posteriores, usa [Deploy-Staging.ps1](scripts/windows/Deploy-Staging.ps1), que respalda la base y los uploads antes de migrar. [Restore-Staging.ps1](scripts/windows/Restore-Staging.ps1) exige una base de restauración `escolar_staging_restore_*` ya creada y vacía y un directorio nuevo bajo `restore-check`; consulta la guía para el comando y la comprobación del respaldo. Programa retención y copia externa cifrada por separado. El CI de Windows valida sintaxis y estructura de los scripts; la instalación del servicio, IIS, TLS, rollback y restauración se ensayan en el staging real antes de abrirlo a usuarios.

---

## 📚 Documentación Adicional

- **`docs/API.md`** — Endpoints detallados con roles requeridos
- **`docs/ARQUITECTURA.md`** — Decisiones técnicas y modelo de datos
- **`docs/ETAPAS_CONTRATO.md`** — Mapeo contra etapas del Anexo A
- **`docs/ESTADO_IMPLEMENTACION.md`** — Estado real, pendientes y dependencias externas
- **`docs/MATRIZ_ACCESO.md`** — Alcance actual por rol para validación institucional
- **`docs/MIGRACIONES.md`** — Procedimiento manual seguro para MySQL y SQL Server
- **`docs/OPERACION_PRODUCCION.md`** — Variables, respaldos, archivos e insumos para publicar
- **`docs/STAGING_WINDOWS_IIS.md`** — Bootstrap, IIS, servicio, respaldo y restauración aislada en Windows Server
- **`etl/README.md`** — Documentación completa del ETL Python

---

## ✅ Características Clave

- Multiplataforma: Web (React), móvil (React Native) y API (NestJS).
- Base de datos portable: MySQL y SQL Server con esquemas espejo.
- Finanzas con Openpay y webhook.
- Seguridad con JWT, roles, alcance por plantel y archivos firmados.
- Reportes PDF y Excel.
- ETL parcial: planteles y alumnos; falta confirmar el esquema certweb y completar otras entidades.
- Configuración dinámica de logo y colores institucionales.

---

## Próximos pasos para el piloto

1. **Verificar el SHA publicado:** consultar la CI completa y aplicar migraciones en una base aislada antes de desplegar.
2. **Ensayar datos reales sin tocar producción:** restaurar una copia institucional aislada, auditar su esquema y probar `db:migrate:status` y `db:migrate` sobre esa copia. Registrar conteos, errores y tiempos.
3. **Preparar staging:** verificar VPS, DNS/TLS, IIS/ARR, servicio API, permisos de `uploads/`, backup externo y restauración completa de MySQL y archivos. Usar [la guía Windows](docs/STAGING_WINDOWS_IIS.md).
4. **Certificar servicios y uso:** Openpay sandbox, webhook/reintentos/conciliación, SMTP, permisos con cuentas de dos planteles, formatos de reportes y pruebas físicas Android/iOS.
5. **Aceptar reglas institucionales:** revisar [las reglas implementadas](docs/REGLAS_PILOTO.md), privacidad y responsables operativos. No activar pagos productivos ni usar datos de alumnos reales antes de cerrar estas verificaciones.

El [plan de auditoría](docs/AUDITORIA_ACTUAL_2026-10-05.md) y su [continuación](docs/CONTINUACION_2026-10-05.md) separan el trabajo ya implementado de la aceptación pendiente.
