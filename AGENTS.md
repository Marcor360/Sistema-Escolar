# Guía para agentes

- No recrear bases existentes, no ejecutar `schema.sql` completo, no usar `DROP`/`TRUNCATE` y no activar `DB_SYNC=true` fuera de prototipos.
- Todo cambio de esquema requiere entidad TypeORM, migración incremental en `database/mysql/` y espejo en `database/sqlserver/`; `schema.sql` es solo paridad documental.
- Validar alcance por plantel en servidor con `ScopeService`; la UI solo refleja opciones.
- Roles: `SUPERADMIN` global; `ADMINISTRATIVO`/`FINANZAS` por planteles asignados; `MAESTRO` por sus grupos; `ALUMNO` solo lo propio.
- Verificación: `cd backend && npm run lint && npm run typecheck && npm test`; `cd web && npm run lint && npm run build`; `cd mobile && npx tsc --noEmit`.

Pendientes P2: paginación uniforme, bitácora de login fallido, documentación completa de zona horaria y evaluación de sesiones móviles largas.
