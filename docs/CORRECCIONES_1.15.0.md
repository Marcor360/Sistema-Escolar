# Correcciones de código — candidato 1.15.0

Fecha: 7 de octubre de 2026. Base de trabajo: `41f5579b7313f3353a1f64a984d5c44ea2b9521c`. La CI del commit publicado se consulta en [GitHub Actions](https://github.com/Marcor360/Sistema-Escolar/actions/workflows/ci.yml); el SHA exacto se entrega con el commit. Este documento no es un acta de aprobación del piloto.

## Resultado de implementación

Se corrigieron transiciones de alumnos/docentes, permisos y sesiones; contexto académico, calendario, notas y reportes; correcciones administrativas y financieras desde web, búsqueda paginada, conciliación y previews; sesión móvil renovable, últimas actualizaciones y estados de pagos. Las reglas y alternativas elegidas se documentan en [REGLAS_PILOTO.md](REGLAS_PILOTO.md). Hay guía para [publicar en el servidor existente](PUBLICAR_SERVIDOR_EXISTENTE.md).

Hallazgos de la auditoría: dashboard de MAESTRO sin petición financiera prohibida; proxy IIS local confiable; pagos manuales con cargo; inscripción única por ciclo bajo bloqueo; grupo con ciclo inmutable; desactivación de plantel/materia y retirada de personal con validación de dependencias; pagos móviles con estado; DTO con límites y normalización; firmas de archivos incluidos logos; SMTP sin destinatario/asunto en logs; calendario por intervalo; Swagger de operaciones críticas ampliado; herramienta de carga de consultas; request ID; readiness con versión, migraciones y permisos de almacenamiento. La comprobación de firmas es básica y no equivale a antivirus. La herramienta de carga de consultas no certifica capacidad de staging ni simula capturas masivas.

## Migración creada

- `database/mysql/migracion_sesiones_rotativas.sql`
- `database/sqlserver/migracion_sesiones_rotativas.sql`

Añade tabla `sesiones` y `usuarios.password_change_required`, con entidad y paridad documental en `schema.sql`. Manifest actualizado; baseline v1 conservado. El resto de cambios usa el esquema existente. API y clientes requieren actualización coordinada y nuevo login.

## Verificaciones

- Backend: `npm ci`, `npm audit` sin vulnerabilidades, lint, typecheck de producción/integración, build y 134 pruebas unitarias. Lint conserva avisos de mocks; no hay `any` explícito en producción.
- Web: `npm ci`, `npm audit` sin vulnerabilidades, lint, build y nueve pruebas, incluida regresión del dashboard de maestro y sesión basada en servidor.
- Móvil: `npm ci`, gate `check-mobile-audit.cjs`, cuatro pruebas, TypeScript y export Android. Permanecen las dos excepciones conocidas de audit `GHSA-86w9-cpqp-85rv` y `GHSA-vfj7-8cjw-p6xm`; no se relaja el gate.
- ETL: tres pruebas de `unittest` verdes.
- Integración: 30 pruebas HTTP, baseline/adopción y migraciones en bases nuevas aisladas MySQL 8.4 y SQL Server 2022, con `DB_SYNC=false`. Se probaron múltiples grupos/planteles, baja/egreso/transferencia, carreras de inscripción, reasignación y baja docente, ciclos cerrados, materias inactivas, aislamiento de eventos, motivo/cierre/reapertura, refresh/reutilización/logout, cambio inicial, auditoría financiera, notas de dos ciclos y Excel con alumno sin nota.
- Windows: sintaxis PowerShell comprobada localmente. Las pruebas de junction/retención requieren Windows; su ejecución completa pertenece al job `windows-scripts` de CI. No se confunde el host Linux con una validación real de Windows Server.
- No se bajaron reglas strict, lint, tests, ni se activó sincronización automática.

## Qué sigue necesitando entorno o decisiones institucionales

Servidor existente: conocer sistema operativo, acceso administrativo, IP/DNS, red y responsable; configurar IIS/ARR, TLS, servicio, DB TLS, ACL y `.env` externo. Certificar restore real de DB/uploads cifrado fuera del servidor, SMTP, Openpay sandbox o mantenerlo deshabilitado, monitoreo y operación. Build firmado y pruebas físicas Android/iOS según alcance; Chrome/Edge y accesibilidad AA/lector de pantalla; formatos institucionales de boleta, privacidad y aprobación de salida. El ETL completo requiere esquema real certweb sanitizado y decisión de migrar histórico; no se inventan mapeos ni se simula certificación.

No se declara Fase 5 cerrada ni PILOTO LISTO. Las comprobaciones locales y CI no sustituyen el recorrido de usuarios reales, la certificación de proveedores ni el restore en staging.

## Archivos modificados o creados

- `AGENTS.md`
- `README.md`
- `backend/.env.example`
- `backend/src/academico/academico.dto.ts`
- `backend/src/academico/academico.service.spec.ts`
- `backend/src/academico/academico.service.ts`
- `backend/src/actividades/actividades.service.spec.ts`
- `backend/src/actividades/actividades.service.ts`
- `backend/src/alumnos/alumnos.controller.ts`
- `backend/src/alumnos/alumnos.dto.ts`
- `backend/src/alumnos/alumnos.service.ts`
- `backend/src/auth/auth.controller.spec.ts`
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/auth.module.ts`
- `backend/src/auth/auth.service.spec.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/dto/auth.dto.ts`
- `backend/src/auth/jwt.strategy.spec.ts`
- `backend/src/auth/jwt.strategy.ts`
- `backend/src/calendario/calendario.controller.ts`
- `backend/src/calendario/calendario.dto.ts`
- `backend/src/calendario/calendario.service.spec.ts`
- `backend/src/calendario/calendario.service.ts`
- `backend/src/calificaciones/calificaciones.controller.ts`
- `backend/src/calificaciones/calificaciones.service.spec.ts`
- `backend/src/calificaciones/calificaciones.service.ts`
- `backend/src/common/contexto-academico.ts`
- `backend/src/common/current-user.decorator.ts`
- `backend/src/common/jwt-auth.guard.ts`
- `backend/src/common/promedio-oficial.spec.ts`
- `backend/src/common/promedio-oficial.ts`
- `backend/src/common/validar-archivo.spec.ts`
- `backend/src/common/validar-archivo.ts`
- `backend/src/configuracion/configuracion.service.ts`
- `backend/src/docentes/docentes.controller.ts`
- `backend/src/docentes/docentes.dto.ts`
- `backend/src/docentes/docentes.service.spec.ts`
- `backend/src/docentes/docentes.service.ts`
- `backend/src/entities/index.ts`
- `backend/src/entities/sesion.entity.ts`
- `backend/src/entities/usuario.entity.ts`
- `backend/src/finanzas/cargos.service.spec.ts`
- `backend/src/finanzas/cargos.service.ts`
- `backend/src/finanzas/cobranza.service.ts`
- `backend/src/finanzas/finanzas.controller.ts`
- `backend/src/finanzas/finanzas.dto.ts`
- `backend/src/finanzas/ordenes.service.ts`
- `backend/src/finanzas/pagos.service.ts`
- `backend/src/health/health.controller.ts`
- `backend/src/main.ts`
- `backend/src/notificaciones/notificaciones.service.ts`
- `backend/src/planteles/planteles.service.ts`
- `backend/src/reportes/reportes.controller.ts`
- `backend/src/reportes/reportes.service.spec.ts`
- `backend/src/reportes/reportes.service.ts`
- `backend/src/usuarios/usuarios.controller.ts`
- `backend/src/usuarios/usuarios.dto.ts`
- `backend/src/usuarios/usuarios.service.ts`
- `backend/test/critical-flows.integration-spec.ts`
- `database/baseline-manifest.json`
- `database/mysql/migracion_sesiones_rotativas.sql`
- `database/mysql/schema.sql`
- `database/sqlserver/migracion_sesiones_rotativas.sql`
- `database/sqlserver/schema.sql`
- `docs/ARQUITECTURA.md`
- `docs/CORRECCIONES_1.15.0.md`
- `docs/ESTADO_IMPLEMENTACION.md`
- `docs/PUBLICAR_SERVIDOR_EXISTENTE.md`
- `docs/REGLAS_PILOTO.md`
- `mobile/App.tsx`
- `mobile/eas.json`
- `mobile/src/api/client.ts`
- `mobile/src/screens/Calificaciones.tsx`
- `mobile/src/screens/EstadoCuenta.tsx`
- `mobile/src/screens/Materias.tsx`
- `mobile/src/screens/Tareas.tsx`
- `mobile/src/sesion.tsx`
- `scripts/performance/consultas.cjs`
- `scripts/windows/Deploy-Staging.ps1`
- `web/src/api/client.ts`
- `web/src/auth/AuthContext.tsx`
- `web/src/auth/RutaProtegida.test.tsx`
- `web/src/components/Conciliacion.tsx`
- `web/src/components/Paginador.tsx`
- `web/src/components/SelectorBuscable.tsx`
- `web/src/pages/Alumnos.tsx`
- `web/src/pages/Calendario.tsx`
- `web/src/pages/Calificaciones.tsx`
- `web/src/pages/Dashboard.test.tsx`
- `web/src/pages/Dashboard.tsx`
- `web/src/pages/Docentes.tsx`
- `web/src/pages/Finanzas.tsx`
- `web/src/pages/Grupos.tsx`
- `web/src/pages/Maestro.tsx`
- `web/src/pages/Usuarios.tsx`
