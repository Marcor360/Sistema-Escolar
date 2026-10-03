# 🎓 Sistema Escolar Multiplataforma (MVP) — Documentación Completa

> **ERP educativo multiplataforma** para gestión académica, administrativa y financiera. El código cubre los flujos principales del MVP; consulta [el estado de implementación](docs/ESTADO_IMPLEMENTACION.md) para distinguirlos de pendientes y dependencias de producción.

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
| **Node.js** | 20+ | Runtime JavaScript |
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
| **React Native** | Expo SDK | App nativa multiplataforma para alumnos |
| **Expo** | - | Framework simplificado con ejectable API |

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
│  │  React/Vite   │  │ React Native │  │     BBVA/BBDO      │   │
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
│  • 23 tablas con naming strategies (snake_case)                │
│  • Esquema espejo MySQL ↔ SQL Server                           │
│  • Migraciones incrementales en database/mysql/ y sqlserver/    │
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

### 1. **Openpay (BBVA/BBDO)**
```typescript
// backend/src/finanzas/openpay.service.ts
- Crea cargos con redirección a pasarela segura
- Webhook confirma pagos: charge.succeeded/failed/cancelled
- Transaction.expired para pagos caducados
- Basic Auth opcional en webhook (OPENPAY_WEBHOOK_USER/PASS)
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
- Idempotente por legacy_id en 12 entidades principales
- Modo --dry-run para pruebas sin escribir datos
```

### 4. **Pasarela de Pagos**
| Proveedor | Estado | Uso |
|-----------|--------|-----|
| Openpay | ✅ Integrado | Cobranza online con redirección |
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
│   │   ├── calificaciones.service.ts # Captura masiva con upsert
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
│   ├── entities/                  # Definiciones TypeORM (23 entidades)
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
│   ├── config/                    # Configuraciones TypeORM, uploads
│   │   ├── typeorm.config.ts      # Configuración DB conmutable MySQL/SQL Server
│   │   └── upload.config.ts       # Configuración Multer (5MB límite)
│   │
│   ├── common/                    # Componentes globales
│   │   ├── bitacora.interceptor.ts # Interceptor para registrar actividad
│   │   ├── jwt-auth.guard.ts      # Guard de autenticación JWT
│   │   ├── roles.guard.ts         # Guard de autorización por roles
│   │   ├── current-user.decorator.ts # Decorador @CurrentUser()
│   │   └── paginacion.dto.ts      # DTO estándar de paginación
│   │
│   ├── seed/                      # Datos de demostración
│   │   └── seed.ts                # Idempotente, exclusivo desarrollo
│   │
│   └── archivos/                  # Archivos estáticos (logo público)
│       └── logo-publico.controller.ts
│
├── database/                      # Esquemas y migraciones
│   ├── mysql/                     # MySQL 8
│   │   ├── schema.sql             # Estructura completa (paridad documental)
│   │   ├── seed.sql               # Datos iniciales
│   │   └── migracion_*.sql        # Migraciones incrementales
│   └── sqlserver/                 # SQL Server 2019+ (espejo 1:1)
│       ├── schema.sql             # Esquema equivalente MySQL
│       ├── seed.sql               # Datos iniciales equivalentes
│       └── migracion_*.sql        # Migraciones incrementales
│
├── package.json                   # Dependencias y scripts
├── tsconfig.json                  # Configuración TypeScript
├── nest-cli.json                  # Configuración NestJS
├── jest.config.cjs                # Configuración tests
└── .env.example                   # Plantilla variables de entorno
```

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
│   │   ├── EstadoCuenta.tsx       # Estado cuenta propio (FINANZAS)
│   │   ├── Perfil.tsx             # Datos personales + cambio contraseña
│   │   └── comunes.tsx            # Componentes reutilizables
│   │
│   └── App.tsx                    # Componente raíz con navegación
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
4. Se emite JWT con expiración diferenciada:
   - WEB: JWT_EXPIRES (default 8h)
   - MÓVIL: JWT_EXPIRES_MOVIL (si definido, más largo)
   ↓
5. Frontend guarda token y actualiza UI según rol
```

### Flujo de Gestión Académica

```
1. ADMINISTRATIVO crea Ciclo Escolar → Materia → Grupo
2. Asigna Materia a Grupo + Docente (GrupoMateria)
3. Inscribe Alumnos al Grupo
4. Maestro ve "Mis Grupos" (solo sus asignaciones)
5. Maestro crea Actividades y sube Materiales
6. Alumno entrega trabajos con archivos ≤5MB
7. Maestro califica entregas y captura parciales
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
6. Administrativo registra pagos manuales (efectivo/transferencia)
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
| **JWT con expiración** | `JWT_EXPIRES` (web), `JWT_EXPIRES_MOVIL` (móvil) |
| **Tokens firmados para archivos** | 5 minutos de vida útil, validación en streaming |
| **Hash SHA256 para tokens de recuperación** | Solo persiste el hash, no el token en claro |
| **Webhook Openpay con Basic Auth opcional** | Configurado con `OPENPAY_WEBHOOK_USER/PASS` |
| **Rate limiting** | 120 req/min global, 5/min en login/recuperación |
| **Encabezados Helmet** | Seguridad HTTP estándar |
| **CORS restringible** | `CORS_ORIGINS` en producción |
| **Swagger apagado en producción** | Exige `JWT_SECRET` real con `NODE_ENV=production` |
| **Contraseñas bcrypt** | Hash seguro de contraseñas |
| **Validación whitelist** | `class-validator` con `whitelist: true` |
| **Permisos por rol** | Validación en API y rutas del portal |

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

### Backend
```bash
cd backend
npm install                    # Instalar dependencias
npm run start:dev              # Desarrollo (http://localhost:3000/api)
ALLOW_DEV_SEED=true npm run seed  # Solo local: requiere 5 contraseñas distintas de 16+ caracteres en backend/.env
npm run lint                   # Validar código
npm run typecheck              # Verificar tipos TypeScript
npm test                       # Ejecutar tests Jest
npm run test:integration       # Flujos HTTP sobre baseline en base escolar_integration_* aislada (DB_SYNC=false)
```

### Frontend Web
```bash
cd web
npm install                    # Instalar dependencias
npm run dev                    # Desarrollo (http://localhost:5173)
npm run build                  # Build de producción
npm run lint                   # Validar código
```

### Frontend Móvil
```bash
cd mobile
npm install                    # Instalar dependencias
npx expo start                 # Iniciar Expo
npx tsc --noEmit               # Verificar TypeScript
```

### Base de Datos
```bash
# MySQL en Docker
docker compose up -d mysql

# SQL Server en Docker (alternativa)
docker compose --profile mssql up -d sqlserver

# Compila, revisa y aplica las migraciones pendientes con DB_SYNC=false.
# npm run build; npm run db:migrate:status; npm run db:migrate
# Consulta docs/MIGRACIONES.md; adopta un historial existente solo tras auditarlo.
```

---

## 📚 Documentación Adicional

- **`docs/API.md`** — Endpoints detallados con roles requeridos
- **`docs/ARQUITECTURA.md`** — Decisiones técnicas y modelo de datos
- **`docs/ETAPAS_CONTRATO.md`** — Mapeo contra etapas del Anexo A
- **`docs/ESTADO_IMPLEMENTACION.md`** — Estado real, pendientes y dependencias externas
- **`docs/MATRIZ_ACCESO.md`** — Alcance actual por rol para validación institucional
- **`docs/MIGRACIONES.md`** — Procedimiento manual seguro para MySQL y SQL Server
- **`docs/OPERACION_PRODUCCION.md`** — Variables, respaldos, archivos e insumos para publicar
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

**Ideal para instituciones educativas que necesitan digitalizar sus procesos administrativos, académicos y financieros en una sola plataforma integral.**
