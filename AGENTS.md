# Guía para agentes

- No recrear bases existentes, no ejecutar `schema.sql` completo, no usar `DROP`/`TRUNCATE` y no activar `DB_SYNC=true` fuera de prototipos.
- Todo cambio de esquema requiere entidad TypeORM, migración incremental en `database/mysql/` y espejo en `database/sqlserver/`; `schema.sql` es solo paridad documental.
- Validar alcance por plantel en servidor con `ScopeService`; la UI solo refleja opciones.
- Roles: `SUPERADMIN` global; `ADMINISTRATIVO`/`FINANZAS` por planteles asignados; `MAESTRO` por sus grupos; `ALUMNO` solo lo propio.
- Los archivos de `uploads/` solo se sirven mediante el módulo `archivos` con enlaces firmados de corta vida; nunca reactivar `useStaticAssets`.
- Verificación: `cd backend && npm run lint && npm run typecheck && npm test`; `cd web && npm run lint && npm run build`; `cd mobile && npx tsc --noEmit`.

La zona horaria está documentada en `docs/ARQUITECTURA.md`; las sesiones usan acceso de 15 minutos y refresh rotativo de 30 días como máximo, persistido con hash y revocable por dispositivo.

La identidad visual se configura en `configuracion_marca` y los clientes la consumen de `GET /api/configuracion/marca`.
