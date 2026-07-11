# Sistema Escolar Multiplataforma (MVP)

Implementación completa del alcance del contrato (Anexo A): backend NestJS,
portal/panel web React, app móvil de alumnos en Expo, base de datos portable
**MySQL / SQL Server**, módulo financiero con **Openpay (BBVA)** y reportes.

## Estructura

```
sistema-escolar-mvp/
├── backend/        API NestJS 10 + TypeORM (JWT, roles, uploads, PDF/Excel, Openpay)
├── web/            Portal web React 18 + Vite (panel administrativo, maestro y finanzas)
├── mobile/         App de alumnos React Native + Expo (materias, tareas, pagos)
├── database/
│   ├── mysql/      schema.sql + seed.sql para MySQL 8
│   └── sqlserver/  schema.sql + seed.sql equivalentes para SQL Server 2019+
├── docs/           API, arquitectura y mapeo contra las etapas del contrato
└── docker-compose.yml
```

## Puesta en marcha (desarrollo)

Requisitos: Node 20+, Docker (opcional para la BD).

```bash
# 1) Base de datos (MySQL en Docker)
docker compose up -d mysql

# 2) Backend
cd backend
cp .env.example .env          # revisa credenciales
npm install
npm run seed                  # solo desarrollo; requiere migraciones aplicadas y crea datos demo
npm run start:dev             # http://localhost:3000/api — Swagger en /api/docs

# 3) Portal web
cd ../web
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173

# 4) App móvil (Expo)
cd ../mobile
cp .env.example .env          # apunta EXPO_PUBLIC_API_URL a la IP de tu máquina
npm install
npx expo start
```

### Usuarios demo (creados por `npm run seed`)

> El seed es idempotente y exclusivo de desarrollo/demostración. No debe ejecutarse en producción ni con `DB_SYNC=true`.

| Rol                          | Correo               | Contraseña  |
|------------------------------|----------------------|-------------|
| Superadmin + Admvo + Finanzas| admin@escuela.mx     | Admin123!   |
| Maestro                      | maestro@escuela.mx   | Maestro123! |
| Alumno                       | alumno1@escuela.mx   | Alumno123!  |
| Alumno                       | alumno2@escuela.mx   | Alumno123!  |

## MySQL y SQL Server

MySQL y SQL Server son motores distintos (no se "coloca" una BD MySQL dentro de
SQL Server); por eso el proyecto soporta **ambos** con el mismo código:

- Cambia de motor con una variable: `DB_TYPE=mysql` o `DB_TYPE=mssql` en `backend/.env`.
- `database/mysql/` y `database/sqlserver/` contienen esquemas equivalentes 1:1
  (23 tablas, snake_case) por si prefieres crear las tablas por script en lugar
  de `DB_SYNC=true`.
- Para SQL Server con Docker: `docker compose --profile mssql up -d sqlserver`
  y en `.env`: `DB_TYPE=mssql`, `DB_PORT=1433`, `DB_USER=sa`, `DB_PASS=Escolar123!`.

## Pasarela de pago (Openpay/BBVA)

La integración está lista en `backend/src/finanzas/openpay.service.ts`
(cargo con redirección + webhook). Conforme al contrato, las credenciales las
contrata y proporciona el cliente:

1. Coloca `OPENPAY_MERCHANT_ID` y `OPENPAY_PRIVATE_KEY` en `backend/.env`
   (sandbox por defecto; producción cambiando `OPENPAY_BASE_URL`).
2. Registra el webhook en el dashboard de Openpay apuntando a
   `POST https://tu-dominio/api/finanzas/webhook/openpay`.
3. Sin credenciales, el resto del sistema opera normal y el endpoint de órdenes
   responde 503 indicando la configuración faltante.

## Seguridad incluida

Rate limiting (120 req/min global, 5/min en login), encabezados `helmet`,
CORS restringible (`CORS_ORIGINS`), webhook de pasarela con Basic Auth opcional,
Swagger apagado y `JWT_SECRET` obligatorio con `NODE_ENV=production`,
contraseñas bcrypt, permisos por rol en API **y** en las rutas del portal.

## Documentación

- `docs/API.md` — endpoints por módulo y roles requeridos.
- `docs/ARQUITECTURA.md` — decisiones técnicas y modelo de datos.
- `docs/ETAPAS_CONTRATO.md` — qué entregable del Anexo A cubre cada pieza.
