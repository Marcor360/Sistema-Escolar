# Guía para agentes

- No recrear bases existentes, no ejecutar `schema.sql` completo, no usar `DROP`/`TRUNCATE` y no activar `DB_SYNC=true` fuera de prototipos.
- Todo cambio de esquema requiere entidad TypeORM, migración incremental en `database/mysql/` y espejo en `database/sqlserver/`; `schema.sql` es solo paridad documental.
- Validar alcance por plantel en servidor con `ScopeService`; la UI solo refleja opciones.
- Roles: `SUPERADMIN` global; `ADMINISTRATIVO`/`FINANZAS` por planteles asignados; `MAESTRO` por sus grupos; `ALUMNO` solo lo propio.
- Verificación: `cd backend && npm run lint && npm run typecheck && npm test`; `cd web && npm run lint && npm run build`; `cd mobile && npx tsc --noEmit`.

Pendientes P2: paginación uniforme y bitácora de intentos de login fallidos. La zona horaria está documentada en `docs/ARQUITECTURA.md`; la sesión móvil admite `JWT_EXPIRES_MOVIL` con el riesgo documentado en `.env.example`.
