# Correcciones y verificación — 1.16.0

Fecha: 7 de octubre de 2026. Base: `a63e921ddbec5ce4c259725f94da08bc1010d7f4` (1.15.0). Commit titulado **1.16.0**, con descripción de cambios y pruebas. SHA y CI exactos se entregan al publicar; [ejecuciones CI](https://github.com/Marcor360/Sistema-Escolar/actions/workflows/ci.yml). Este documento no aprueba el piloto.

## Correcciones

| Hallazgo | Resultado |
|---|---|
| Finanzas tras transferencia | `plantelId` propio en cargos, órdenes y pagos; permisos, listados, conciliación, auditoría, recargos, cobranza y reportes usan el origen. El alumno ve sus propios movimientos de todos sus planteles; personal solo los movimientos de su alcance. Selector financiero paginado permite gestionar cargos anteriores sin exponer expediente/correo del nuevo plantel. |
| Analítica histórica | Ciclo CERRADO incluye materias/grupos retirados y alumnos que participaron aunque su inscripción esté BAJA. Se muestran participación histórica e inscripción vigente por separado. Elegir el ID del ciclo actual no convierte relaciones dadas de baja en vigentes. |
| Rendimiento analítico | Agregados en SQL y mapas por clase; no se cargan expedientes/notas/entregas completos para filtros anidados. Regla y expresión SQL P1-P3 centralizadas en `promedio-oficial.ts`; redondeo por alumno antes de promediar la clase. |
| Recuperación push | La notificación se guarda con `pushPendiente`; cola y retirada del marcador en la misma transacción. Worker recupera fallos y deduplica por notificación/dispositivo. Recuperar la cola no requiere activar envíos externos. |
| Cobranza parcial | Registro durable por destinatario con actor, clave diaria del saldo, estado e intentos. Solicitudes repetidas del mismo día/saldo no generan duplicados. Cada resultado se audita, incluso en un lote parcialmente enviado o interrumpido. |
| Reintentos SMTP | Rechazos temporales: hasta tres intentos. Rechazo permanente o SMTP ausente: ERROR. Timeout o proceso interrumpido: INCIERTO, sin reenvío automático. Reintento manual requiere scope, motivo y confirmación después de verificar proveedor. Message-ID estable; SMTP no garantiza exactly-once ni lectura. |
| Formularios | Diálogos de motivo/título conservan datos y muestran error tras fallo, bloquean envío doble, usan foco/modal nativos y restauran foco. Labels asociados a controles en alumnos/docentes/grupos/finanzas/maestro. Edición de alumno bloquea el formulario mientras carga para evitar sobrescribir datos recién escritos. |
| Navegador | Dos recorridos Chromium reales, con API y DB reales: alta/corrección, grupo/docente/materia, inscripción/baja/reinscripción, consulta y PDF; cargo/cancelación, pago y anulación. Sin interceptar respuestas. Verifican renovación de sesión al recargar y ausencia de errores JavaScript. Nuevo job obligatorio `web-e2e`; se mantienen todos los jobs anteriores. |

La cobranza informa **programados**, no “enviados”, al crear el lote. La web muestra seguimiento paginado y reintento con advertencia para resultados inciertos. Un correo simulado nunca se registra como ENVIADO.

## Migración incremental

- `database/mysql/migracion_integridad_operativa.sql`
- `database/sqlserver/migracion_integridad_operativa.sql`

Añade origen financiero NOT NULL con FK/índices, marcador outbox de notificaciones y `cobranza_envios`. Entidades, manifest y `schema.sql` actualizados; baseline v1 intacto y `DB_SYNC=false`.

Para cargos anteriores se recupera la primera bitácora CREAR_CARGO/GENERAR_COLEGIATURA con plantel; órdenes heredan del cargo, pagos del cargo/orden. Sin evidencia se usa el plantel actual del alumno. **No se puede reconstruir un origen antiguo desconocido**: auditar registros legados sin bitácora, especialmente transferidos, antes de migrar una base institucional. La prueba instala datos anteriores al cambio con alumno transferido y verifica el backfill en ambos motores.

Aplicar con el runner de [MIGRACIONES.md](MIGRACIONES.md), nunca ejecutando `schema.sql` sobre una base existente. Actualizar API y clientes coordinados; mantener proveedores deshabilitados/simulados hasta certificarlos. Si existen varias instancias, el registro/lease y claves únicas protegen la cola, pero un timeout SMTP requiere resolución humana por la ambigüedad del protocolo.

Rollback: detener escrituras/workers, conservar backup DB/uploads restaurado y verificado, y volver al artefacto previo con las columnas/tablas aditivas conservadas. La API anterior calcula scope por plantel actual: **no reabrir finanzas de alumnos transferidos con ese artefacto**. Restaurar backup aislado y comprobar relaciones/saldos antes de un rollback completo. No se agrega ninguna migración destructiva.

## Pruebas

- Backend: instalación congelada, audit cero, lint sin errores ni avisos productivos, typecheck, build y 154 pruebas unitarias.
- Web: instalación, audit cero, lint, build y 13 pruebas, incluida conservación de motivo/foco tras error.
- Móvil: instalación, audit cero sin excepciones, ocho pruebas + cinco del gate, TypeScript y export Android; versión Expo actualizada.
- ETL: tres pruebas existentes; no se presenta el ETL como completo.
- Integración normal: 45 casos por motor MySQL 8.4 / SQL Server 2022. En el job de navegador: 47 casos, incluidos los dos recorridos Chromium. Baseline/adopción/migraciones, paridad física y controles previos conservados.
- Carga: 100 alumnos, tres clases, 900 notas, nueve capturas HTTP en tandas de tres simultáneas; analítica devuelve 100 promedios completos de 80 por clase. Mide p95 de captura y latencia analítica sin registrar datos personales. Resultados locales y CI no certifican capacidad del servidor real.
- Windows: job existente de sintaxis/estructura/junction/retención; no equivale a certificar staging.

Resultados de la última carga local sobre bases nuevas, con 100 alumnos, 900 notas y concurrencia tres:

| Motor | p95 de captura HTTP (lote de 100 notas) | Consulta analítica |
|---|---:|---:|
| MySQL 8.4 | 1.224 ms | 19 ms |
| SQL Server 2022 | 15.696 ms | 117 ms |

Ambos conservaron las 900 notas y los promedios esperados. SQL Server necesita evaluación adicional si el objetivo institucional exige capturas más rápidas: estos resultados muestran integridad, no un SLA aprobado. La comparación es orientativa: contenedores y procesos comparten recursos de este entorno; repetir en el hardware del servidor con volúmenes institucionales antes de fijar capacidad.

Para repetir la carga usar `node scripts/performance/integracion.cjs`, con dependencias instaladas y la misma configuración de integración de CI, `RUN_DB_INTEGRATION=1`, `DB_SYNC=false` y **base nueva** cuyo nombre empiece `escolar_integration_`. El wrapper ejecuta baseline/regresiones/carga y conserva el estado de salida. Rechaza producción o configuración incompleta. Para ejecutar también los recorridos: `RUN_WEB_E2E=1`, instalar Chromium mediante Playwright; si ya existe una instalación validada, `PLAYWRIGHT_CHROMIUM_EXECUTABLE` indica su ruta. La prueba inicia Vite en 127.0.0.1:5181 y lo detiene al terminar. No usar este runner contra staging ni datos personales.

## Pendiente externo

ETL histórico sigue requiriendo esquema real sanitizado de certweb para usuarios/docentes/ciclos/materias/grupos/inscripciones. Sin ese contrato no es correcto inventar columnas ni declarar migración completa; la importación CSV/XLSX del sistema sigue disponible para altas nuevas. Debe decidirse si el piloto llevará histórico.

Servidor/HTTPS, restore real cifrado externo, SMTP y Openpay sandbox, entrega push real, build firmado y teléfono físico, Chrome/Edge con personal, AA/lector de pantalla, privacidad, boletas y responsable de operación siguen pendientes. Los recorridos automatizados no sustituyen esa aceptación. No se declara PILOTO LISTO.

## Archivos modificados o creados


- `.github/workflows/ci.yml`
- `README.md`
- `backend/package-lock.json`
- `backend/package.json`
- `backend/src/analitica/analitica.service.ts`
- `backend/src/common/promedio-oficial.ts`
- `backend/src/entities/cargo.entity.ts`
- `backend/src/entities/cobranza-envio.entity.ts`
- `backend/src/entities/index.ts`
- `backend/src/entities/notificacion.entity.ts`
- `backend/src/entities/orden-pago.entity.ts`
- `backend/src/entities/pago.entity.ts`
- `backend/src/finanzas/cargos.service.spec.ts`
- `backend/src/finanzas/cargos.service.ts`
- `backend/src/finanzas/cobranza.service.ts`
- `backend/src/finanzas/finanzas.controller.ts`
- `backend/src/finanzas/finanzas.dto.ts`
- `backend/src/finanzas/ordenes.service.spec.ts`
- `backend/src/finanzas/ordenes.service.ts`
- `backend/src/finanzas/pagos.service.spec.ts`
- `backend/src/finanzas/pagos.service.ts`
- `backend/src/notificaciones/notificaciones.service.spec.ts`
- `backend/src/notificaciones/notificaciones.service.ts`
- `backend/src/notificaciones/push.service.ts`
- `backend/src/reportes/reportes.service.ts`
- `backend/src/seed/seed.ts`
- `backend/test/critical-flows.integration-spec.ts`
- `backend/test/recorridos-web.ts`
- `database/baseline-manifest.json`
- `database/mysql/migracion_integridad_operativa.sql`
- `database/mysql/schema.sql`
- `database/sqlserver/migracion_integridad_operativa.sql`
- `database/sqlserver/schema.sql`
- `docs/ARQUITECTURA.md`
- `docs/CORRECCIONES_1.16.0.md`
- `docs/ESTADO_IMPLEMENTACION.md`
- `docs/REGLAS_PILOTO.md`
- `mobile/app.json`
- `mobile/package-lock.json`
- `mobile/package.json`
- `scripts/performance/integracion.cjs`
- `web/package-lock.json`
- `web/package.json`
- `web/src/components/SeguimientoCobranza.tsx`
- `web/src/components/useDialogoMotivo.test.tsx`
- `web/src/components/useDialogoMotivo.tsx`
- `web/src/pages/Alumnos.tsx`
- `web/src/pages/Analitica.tsx`
- `web/src/pages/Docentes.tsx`
- `web/src/pages/Finanzas.tsx`
- `web/src/pages/Grupos.tsx`
- `web/src/pages/Maestro.tsx`
