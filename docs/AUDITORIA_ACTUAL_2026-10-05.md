# Auditoría actual y plan para piloto — 5 de octubre de 2026

## Alcance y estado de partida

Revisión del `main` local y remoto en `a05bf4e4a5406c1368db5116e283be7e8e52f168` (commit «1.10.2»). Los paquetes `backend`, `web` y `mobile` declaran `1.10.0`. No hay `package.json` raíz ni `CLAUDE.md`. El árbol estaba limpio al iniciar. La CI del SHA inicial terminó correctamente en [run 37176158239](https://github.com/Marcor360/Sistema-Escolar/actions/runs/37176158239). Después de terminar la auditoría se implementó el primer cambio de seguridad, descrito al final; esa CI no certifica el cambio sin publicar.

Se leyeron README, AGENTS, ejemplos de entorno, Compose, documentación de arquitectura/operación/migraciones/acceso, workflows, inventario de controladores, entidades, DTO, guards, servicios y pruebas, rutas web, navegación y API móvil, ETL y scripts Windows. Se contrastaron los hallazgos antiguos con el código vigente. La inspección estática y las pruebas automatizadas no sustituyen aceptación institucional, pruebas de carga ni validación en el servidor destino.

Arquitectura: NestJS/TypeORM es la fuente de reglas y permisos; React/Vite sirve el portal; Expo/React Native sirve exclusivamente al alumno; MySQL y SQL Server tienen baselines, migraciones incrementales y runner; Python contiene ETL parcial. El despliegue objetivo documentado es Windows Server 2019, IIS/ARR/TLS, NestJS local y MySQL. `ScopeService` aplica plantel en servidor, los archivos se descargan con enlaces firmados y `DB_SYNC=true` se rechaza en producción.

## Estado general estimado

Porcentajes de **preparación para un piloto institucional**, juicio orientativo basado en funciones presentes y verificaciones pendientes; no son cobertura de pruebas ni medición objetiva de avance.

| Área | Estimación | Evidencia y límite principal |
|---|---:|---|
| Backend | 85 % | Módulos académicos, financieros, archivos y reportes; faltan aceptación real y algunos contratos operativos. |
| Web | 80 % | Pantallas principales y build; falta prueba amplia de flujos, dispositivos y accesibilidad. |
| Móvil | 70 % | App solo alumno y bundle Android; sin build nativo firmado ni experiencia offline robusta. |
| Seguridad | 80 % | Guards, alcance, JWT, migraciones y pruebas; cierre de sesión sin revocación individual y dependencias por vigilar. |
| Infraestructura | 55 % | Scripts de staging y documentación; falta evidencia de instalación y operación en VPS elegido. |
| QA | 70 % | CI y suites en ambos motores; faltan pruebas institucionales y de proveedores externos. |
| Producción | 40 % | Faltan despliegue, restauración real, pagos sandbox, SMTP y aceptación legal/operativa. |

## Terminado en el repositorio

- JWT con bcrypt, expiración, control de versión de sesión al cambiar/restablecer contraseña, roles y verificación de usuario activo; `passwordHash` no se selecciona por defecto.
- CRUD y flujos de planteles, usuarios, docentes, alumnos, ciclos, grupos, materias, inscripciones, actividades, calificaciones, boleta PDF y exportaciones Excel. Grupos usan la clave `(cicloId, plantelId, nombre)` en entidad y migraciones espejo.
- Pagos manuales con saldo validado bajo bloqueo, órdenes Openpay y webhook idempotente con autenticación obligatoria en producción; bitácora financiera.
- Baselines MySQL/SQL Server, historial `schema_migrations`, runner `adopt/status/up` con bloqueo y suite HTTP de integración en ambos motores en CI con `DB_SYNC=false`.
- Portal web por rol; app móvil limitada al alumno con SecureStore y perfiles EAS; health endpoint; enlaces firmados para archivos; scripts de staging, respaldo, restauración y retención.

## Hallazgos vigentes

Cada prueba indicada es un **criterio de cierre**, no una prueba ya ejecutada.

### P0 — impide declarar listo el piloto/producción

**P0-1. Recuperación de datos no certificada.** Archivo: `docs/STAGING_WINDOWS_IIS.md:76-90`, `scripts/windows/Restore-Staging.ps1:11-52`. Severidad **crítica operativa**; impacto: pérdida de datos. Existen scripts y simulaciones de retención, pero no hay evidencia de una restauración real del MySQL y `uploads` del servidor institucional ni de copia cifrada externa programada. Corrección: instalar cuenta mínima y tareas, respaldo externo y ejecutar restauración en base/ubicación aisladas con conteos y descargas verificadas. Prueba: acta con fecha, identificadores de respaldos, conteos, tiempo de recuperación y resultado, sin datos personales. No ejecutar sobre la base activa.

**P0-2. Pagos y correo no certificados con servicios reales.** Archivo: `backend/src/finanzas/ordenes.service.ts:71-112`, `backend/src/auth/auth.service.ts:94-145`, `docs/ESTADO_IMPLEMENTACION.md:10-18`. Severidad **alta**; impacto: pagos, acceso y operación. El código gestiona reintentos, conciliación requerida y tokens, pero faltan credenciales y evidencia de pago sandbox exitoso/rechazado, webhook duplicado, timeout, devolución si se habilita, conciliación y entrega SMTP real. Corrección: ejecutar matriz sandbox con cuentas del titular, revisar órdenes que requieran conciliación y ensayo de recuperación por buzón. Prueba: referencias de transacción saneadas, estado local/Openpay concordante y restablecimiento de una sola vez. Bloquea producción **si se activan pagos o recuperación**.

**P0-3. Servidor y migración histórica sin validación.** Archivo: `docs/STAGING_WINDOWS_IIS.md:3-38`, `docs/MIGRACIONES.md:11-28`, `backend/src/database/migrate.ts:14-31`. Severidad **alta operativa**; impacto: disponibilidad/integridad. Los scripts y la CI prueban bases aisladas; no hay evidencia de DNS/TLS/firewall/ACL reales ni de `adopt/up` sobre copia de base institucional histórica. Corrección: auditar VPS, ensayar actualización sobre copia restaurada, comparar esquema y probar rollback compatible. Prueba: checklist de IIS/ARR/NSSM/puertos, `health`, historial de migraciones y consultas de paridad antes de publicar. No aplicar baseline ni `schema.sql` a una base existente.

No se confirmó un IDOR P0 reproducible en las rutas revisadas. Eso no equivale a una prueba exhaustiva con cuentas institucionales por rol/plantel.

### P1 — necesario antes del piloto

**P1-1. Cierre de sesión sin revocación del JWT emitido (resuelto en el árbol de trabajo).** Archivo de evidencia inicial: `backend/src/auth/auth.controller.ts:17-48`, `web/src/auth/AuthContext.tsx:38-42`, `mobile/App.tsx:101-104`. Severidad **alta**; impacto: sesión robada o dispositivo compartido. Antes del cambio web y móvil solo borraban el token local. Se añadió `POST /auth/logout`, que incrementa condicionalmente `session_version`; todos los JWT con esa versión quedan revocados. Los clientes esperan respuesta del servidor y muestran error si no pueden cerrar. Prueba: unidad local pasó; caso HTTP de token antiguo→401 y nuevo token→200 incorporado a integración para el siguiente run MySQL/SQL Server. La política actual cierra todas las sesiones de la cuenta, no solo el dispositivo actual; documentar y comunicar este comportamiento.

**P1-2. Calificaciones sin cierre de periodo.** Archivo: `backend/src/calificaciones/calificaciones.service.ts:42-72`, `backend/src/calificaciones/calificaciones.dto.ts:11-23`. Severidad **media/alta de negocio**; impacto: integridad académica. Hay captura masiva transaccional, rango 0–100 y control de docente asignado, pero no se encontró bloqueo de parciales cerrados ni historial de valor anterior en la operación. Corrección: acordar regla institucional de cierre/corrección y registrar cambio con actor, momento, anterior y nuevo si se exige. Prueba: maestro asignado puede capturar periodo abierto, no cerrado; usuario ajeno sigue recibiendo 403.

**P1-3. Reportes sin certificación de formato ni volumen.** Archivo: `backend/src/reportes/reportes.service.ts:110-160`, `backend/src/reportes/reportes.service.ts:230-280`. Severidad **media**; impacto: reportes/operación. PDF/Excel existen, pero no hay comparación con formatos oficiales ni prueba de volúmenes reales; las exportaciones cargan conjuntos completos. Corrección: cotejar muestras anonimizadas y ensayar tamaños máximos esperados; introducir streaming/paginación interna solo si la medición lo requiere. Prueba: totales, acentos, fechas, nombres, límites de memoria y tiempo aceptados por la institución.

**P1-4. Cobertura de comportamiento de clientes escasa.** Archivo: `web/src/auth/RutaProtegida.test.tsx:1`, `mobile/src/api/errores.test.ts:1`, `.github/workflows/ci.yml:23-58`. Severidad **media**; impacto: regresiones de UX y permisos. Web tiene 5 pruebas y móvil 2 de utilidades; no hay pruebas automatizadas de formularios académicos/financieros ni sesión y navegación móvil en dispositivo. Corrección: cubrir primero login, expiración, cambio de rol, captura de notas, pago y errores/red. Prueba: casos positivos/negativos en CI y recorrido manual en navegadores/dispositivos acordados.

**P1-5. Sin modo offline de datos del alumno.** Archivo: `mobile/App.tsx:43-88`, `mobile/src/screens/Inicio.tsx:17-64`. Severidad **media**; impacto: disponibilidad/UX. Solo la marca se guarda para uso sin red; pantallas de datos dependen de la API y no hay detección central de conectividad ni último contenido seguro. Corrección: diseñar caché por alumno para consultas no sensibles o protegida con borrado al cerrar sesión, aviso de antigüedad y reintento. Prueba: abrir materias/notas con y sin red, cambiar de cuenta y verificar aislamiento.

**P1-6. Auditoría de dependencias backend cambió después de la última CI.** Archivo: `backend/package.json:29-41`, `.github/workflows/ci.yml:23`. Severidad **media**; impacto: seguridad/mantenimiento. El `npm audit --json` actual informa 4 avisos moderados en la cadena `typeorm → mssql → tedious → sprintf-js`; la CI del SHA pasó antes de que el registro presentara este resultado. No hay avisos altos/críticos en backend; web informa cero. Corrección: evaluar exposición de la ruta SQL Server y actualización compatible, registrar decisión y volver a ejecutar CI; no usar la degradación mayor sugerida por npm sin pruebas. Prueba: audit reproducible y suite MySQL/SQL Server verde.

### P2 — antes de comercializar

**P2-1. ETL y carga inicial incompletos.** Archivo: `etl/README.md:23-37`, `etl/etl/extract.py:1`. Severidad **media**; impacto: migración/onboarding. Solo planteles y alumnos tienen pipeline parcial; el origen certweb usa nombres de referencia sin validar. Corrección: obtener esquema sanitizado, resolver identidad de usuarios y ampliar extract/transform/validate/dry-run/import/reconcile por entidad, con previsualización de duplicados. Prueba: conteos, relaciones y rechazos explicados contra copia real de origen y ambos motores de destino.

**P2-2. Conciliación y documentos financieros necesitan proceso institucional.** Archivo: `backend/src/finanzas/ordenes.service.ts:71-112`, `backend/src/finanzas/finanzas.controller.ts:43-133`. Severidad **media**; impacto: operaciones financieras. La API marca órdenes que requieren conciliación, pero no se encontró flujo completo de conciliación por lotes, devolución ni emisión de recibo fiscal/institucional. Corrección: definir responsable, procedimiento y formato exigido antes de comercializar; implementar solo el alcance aprobado. Prueba: orden ambigua resuelta una vez, rastro auditable y saldo correcto.

**P2-3. Automatización operativa/observabilidad parcial.** Archivo: `docs/STAGING_WINDOWS_IIS.md:76-90`, `backend/src/health/health.controller.ts:10`. Severidad **media**; impacto: disponibilidad. Hay health y scripts de retención, pero la programación diaria, copia externa cifrada, alertas de disco/DB/proceso y prueba periódica de restore son instrucciones, no configuración desplegada. Corrección: instalar tareas y alertas con responsables, límites y ensayo documentado. Prueba: fallo inducido de tarea/health genera aviso y se recupera según procedimiento.

**P2-4. Onboarding y accesibilidad por certificar.** Archivo: `web/src/App.tsx:8-23`, `web/src/pages/Grupos.tsx:1`, `docs/ESTADO_IMPLEMENTACION.md:6-18`. Severidad **media**; impacto: adopción. Existen pantallas separadas, pero no asistente/importación segura ni aceptación WCAG AA completa. Corrección: observar a personal creando institución→ciclo→grados/grupos→materias→docentes→alumnos→asignaciones; arreglar fricciones medidas. Prueba: tarea completada por usuarios objetivo y revisión de teclado, foco, contraste y estados loading/empty/error/success.

**P2-5. App móvil y avisos pendientes de distribución.** Archivo: `mobile/eas.json:1-21`, `mobile/App.tsx:108-139`. Severidad **media**; impacto: lanzamiento. CI exporta JS Android, pero faltan build nativo firmado, prueba en dispositivos y notificaciones push. Corrección: configurar cuenta EAS institucional, URL HTTPS y pruebas de dispositivo; planificar push después de estabilizar datos. Prueba: instalación preview y producción, sesión, archivos, pagos y expiración en dispositivos acordados.

### P3 — evolución, fuera de la estabilización

Multiinstitución/aislamiento tenant, planes, suscripciones, portal tutor, nuevas pasarelas y WhatsApp, analítica avanzada, automatización e IA. No introducirlos en la fase de piloto.

## Matriz de permisos verificada por código

Leyenda: **S** permitido; **C** condicionado al scope indicado; **—** prohibido. `SUPERADMIN` hereda permisos de rol por `RolesGuard` y tiene alcance global. La matriz es un resumen de acciones críticas; el catálogo de rutas está en `docs/API.md` y requiere pruebas con cuentas reales.

| Acción | ALUMNO | MAESTRO | ADMINISTRATIVO | FINANZAS | SUPERADMIN | Condición en servidor |
|---|:---:|:---:|:---:|:---:|:---:|---|
| Consultar expediente de alumno | C | C | C | C | S | Propio; grupo activo asignado; plantel asignado. |
| Crear/editar alumno e inscripción | — | — | C | — | S | Plantel del actor y grupo activo. |
| Crear/editar grupo y asignación docente | — | — | C | — | S | Plantel asignado; docente asociado. |
| Publicar actividad/material | — | C | C | — | S | Grupo-materia asignado o plantel. |
| Entregar tarea | C | — | — | — | — | Alumno propio inscrito. |
| Capturar/consultar notas de clase | C | C | C | — | S | Alumno solo propias; maestro solo asignación; administración por plantel. |
| Descargar boleta | C | C | C | — | S | Propia, grupo asignado o plantel. |
| Ver estado de cuenta | C | — | C | C | S | Propio o plantel asignado. |
| Registrar pago manual | — | — | — | C | S | Plantel asignado, saldo y transacción. |
| Crear orden Openpay | C | — | — | C | S | Cargo propio o del plantel. |
| Administrar usuarios globales | — | — | — | — | S | Solo SUPERADMIN. |

Pruebas críticas existentes en `backend/test/critical-flows.integration-spec.ts` y suites de servicios cubren parte de alcance, pagos y archivos; ampliar con cuentas cruzadas de dos planteles, maestro no asignado, alumno ajeno y combinaciones de roles antes del piloto.

## Verificación ejecutada

| Lugar | Comandos/resultados |
|---|---|
| Backend local | `npm run lint`, `npm run typecheck`, `npm test -- --runInBand` (22 suites/113 pruebas después del cambio) y `npm run build`: pasan. `npm audit --json`: sale 1, 4 moderadas; 0 altas/críticas. |
| Web local | `npm run lint`, `npm test` (2 archivos/5 pruebas), `npm run build`, `npm audit --json`: pasan, audit 0. Build incluye typecheck. |
| Móvil local | `npx tsc --noEmit`, `npm test` (2 pruebas), `npx expo export --platform android`, `node ../scripts/check-mobile-audit.cjs`: pasan; siguen dos excepciones Expo/Metro documentadas. No hay script lint. |
| ETL local | `python -m unittest discover -s etl/tests -v` desde raíz: 3 pruebas pasan. Desde `etl/` el mismo patrón falla por ruta de importación; la CI usa la raíz. |
| Windows local | `./scripts/windows/Test-StagingScripts.ps1` y `./scripts/windows/Test-PruneStaging.ps1`: pasan; son pruebas de scripts, no un restore real. |
| CI remota del mismo SHA | [Run 37176158239](https://github.com/Marcor360/Sistema-Escolar/actions/runs/37176158239): backend, web, mobile, ETL, Windows, integración MySQL y SQL Server completados con éxito. No se repitió integración DB local porque no había servicios escuchando en 3306/1433. |
| No verificado | Openpay/SMTP reales, restore real, IIS/TLS/firewall/VPS, build nativo firmado, accesibilidad completa, dispositivos y migración histórica institucional. |

No hay scripts root de lint/typecheck/test/build. El backend no declara e2e separado; `test:integration` ejecuta la suite HTTP con bases aisladas. Web y móvil no declaran `typecheck`/`lint` respectivamente; se usó `tsc` directo en móvil y el build web incluye TypeScript.

## Roadmap y lista de piloto

1. **Seguridad/integridad:** validar en CI la revocación global implementada; acordar duración de sesión móvil y regla de cierre de parciales; verificar permisos cruzados y dependencias. Sin cambios destructivos.
2. **Staging operativo:** auditar VPS; preparar IIS/ARR/TLS/NSSM, MySQL local, puertos y ACL; ensayar migraciones sobre copia; programar respaldo externo y ejecutar restore real.
3. **Core académico:** recorrer con personal institución→usuarios→alumnos/docentes→ciclo→grados/grupos→materias→asignaciones→inscripciones→actividades→captura→boleta; cotejar PDF/Excel.
4. **Finanzas:** ensayar cargos, descuentos/becas/recargos, pago manual, Openpay sandbox y reconciliación; probar SMTP y recuperación completa.
5. **QA y dispositivos:** pruebas por rol/plantel, responsive, teclado/lector, móvil preview/nativo, pérdida de red; registrar incidentes y criterios de aceptación.
6. **Piloto:** verificar responsables, consentimiento/privacidad, monitoreo, backup/restore, rollback, soporte y firma de aceptación. ETL ampliado solo si se requiere migrar datos históricos para el piloto.
7. **Producto comercial y SaaS:** abordar P2 tras piloto estable; P3 como proyecto separado.

Checklist mínimo de salida: [ ] institución y marca; [ ] roles/usuarios; [ ] alumnos/docentes; [ ] ciclo/grados/grupos/materias; [ ] asignaciones/inscripciones; [ ] actividades/entregas; [ ] notas/boletas; [ ] cargos/pagos/conciliación; [ ] recuperación SMTP; [ ] permisos cruzados; [ ] base y uploads respaldados; [ ] restore aislado probado; [ ] TLS/puertos/health/alertas; [ ] navegador y dispositivos; [ ] responsable operativo y aprobación institucional.

## Archivos candidatos de una implementación posterior

La lista al cierre de la auditoría era: sesiones en `backend/src/auth/`, `web/src/auth/AuthContext.tsx`, `mobile/App.tsx`; cierre académico en `backend/src/calificaciones/`, entidad y migraciones espejo según regla acordada; cobertura en `backend/test/critical-flows.integration-spec.ts`, pruebas web/móvil y CI; reportes/finanzas en `backend/src/reportes/` y `backend/src/finanzas/`; offline móvil en `mobile/src/api/` y pantallas; ETL en `etl/etl/` tras conocer certweb; operación en `scripts/windows/` y documentación Windows. El bloque de sesiones ya se modificó después de esa lista.

## Ejecución posterior a la auditoría

Se añadió `POST /auth/logout` protegido por JWT. La operación incrementa `usuarios.session_version` solo si el token corresponde a la versión vigente; no necesita cambio de esquema porque esa columna ya existe. Web y móvil llaman a la API antes de borrar el token local. Si la llamada falla por red, conservan la sesión y muestran error para no presentar un cierre como revocado cuando el servidor no lo confirmó. El cierre de sesión es **global para los JWT vigentes de esa cuenta**. Se añadieron dos pruebas unitarias y un caso HTTP de integración en ambos motores. Lint, typecheck, pruebas unitarias y build/export de los tres paquetes pasan localmente. La integración HTTP del código nuevo queda pendiente de la siguiente CI o de una base aislada disponible.
