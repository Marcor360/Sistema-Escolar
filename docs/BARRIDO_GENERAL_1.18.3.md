# Barrido general — 1.18.3

Fecha: 8 de octubre de 2026 (America/Mexico_City). Base de revisión: `ffcf2dc42207903b2b29e54384aa48b9db263643` (1.18.2). Versión del commit: **1.18.3**.

Se contrastaron los contratos entre backend, web y móvil, entidades y esquemas de ambos motores, baseline y migraciones, autenticación, calendario, reportes, ETL, configuración y documentación. El barrido combina revisión dirigida, comprobaciones estáticas y regresiones ejecutables; no certifica la ausencia absoluta de errores ni una lectura exhaustiva línea por línea de todos los archivos.

## Correcciones y regresiones

| Conexión | Fallo detectado | Corrección y cobertura |
| --- | --- | --- |
| DTO → base | `IsOptional` aceptaba `null` en campos que no admiten nulos, causando errores o estados incoherentes. | Decorador que omite únicamente `undefined`; conserva los campos deliberadamente nullable. Pruebas unitarias y HTTP. |
| Catálogos y finanzas | PATCH vacío, materia inexistente y claves repetidas podían terminar como error de base. Importes con demasiados decimales se redondeaban implícitamente. | Errores 400/404/409, longitud, normalización y límites acordes a DECIMAL(12,2). Regresiones en ambos motores. |
| Ciclos y fechas | Un timestamp se aceptaba para columnas DATE; la web presentaba fechas civiles en el día anterior según su zona horaria. | Ciclos exigen YYYY-MM-DD estricto. Fechas civiles conservan el día; los intervalos del calendario abarcan días locales completos. |
| Calendario web → API | Crear/borrar perdía el intervalo aplicado; el formulario permitía solicitudes simultáneas. | Filtro confirmado persistente, bloqueo de doble envío, etiquetas accesibles y datos conservados al fallar. Prueba de componente. |
| Cierre de ciclo | Cancelar una confirmación podía anunciar éxito; un fallo perdía la clave escrita. | Diálogo accesible con confirmación exacta, reintento con datos preservados y éxito solo después de la operación. |
| Refresh móvil | Un fallo transitorio del servidor durante la renovación borraba una sesión válida. | 429/500/503 conservan SecureStore; 401/403 y ausencia de refresh revocan la sesión local. Cinco regresiones con el cliente Axios. |
| Descargas y URL | Abrir la pestaña después de esperar la API podía activar el bloqueo de ventanas; espacios/barras finales alteraban la URL base. | Pestaña abierta desde el gesto del usuario, sin acceso al opener, cerrada al fallar; normalización de URL. Pruebas de cliente. |
| Difusión → notificaciones | Destinatarios inválidos o títulos/mensajes demasiado largos llegaban al almacenamiento. | Validación de IDs, roles y límites 150/600 antes de escribir. |
| Configuración → boleta | El PDF usaba un nombre del entorno que no seguía la identidad configurada en web/móvil. | Reportes consume ConfiguracionService; prueba que extrae el texto del PDF real y contrasta el nombre institucional. Emisión con zona institucional explícita. |
| Logos → archivos | Fallar al persistir dejaba el nuevo archivo; ediciones concurrentes sobrescribían cambios; la limpieza del anterior no tenía reintento. | Bloqueo transaccional de la marca, retirada del archivo nuevo ante error y cola persistente existente para sustitución/baja. Pruebas de fallo y concurrencia. |
| Entidades → DDL | Colores CHAR(7) y códigos ASCII de cobranza se declaraban mediante tipos inferidos diferentes al esquema. | Metadata explícita CHAR/VARCHAR. Paridad automatizada de los tipos físicos de las 39 tablas y 319 columnas, con equivalencias documentadas para datetime/datetime2 y texto portable. |
| ETL → autenticación | Crear usuario y expediente no asignaba el rol ALUMNO; fallos de lote podían dejar la transacción abierta. | Rol, usuario y expediente en la misma transacción; rollback y cierre de cursor. Rechaza catálogo sin rol antes de crear cuentas. Cinco pruebas con cursores simulados. |
| Dependencias | La instalación limpia detectó tres avisos críticos sobre handlebars 4.7.9, usado por ts-jest. | Lockfile actualizado a 4.7.10 y auditoría repetida. |
| Documentación/CI | Contratos documentados de sesión, paginación, ciclo y conciliación se habían quedado atrás. | Documentación actualizada; CI verifica versiones, enlaces README y rutas de clientes junto con baseline y migraciones espejo. |

El comprobador estático contrasta 159 llamadas literales o plantillas de cliente con 151 rutas del backend. No demuestra todos los tipos de payload/respuesta ni cubre rutas construidas mediante expresiones arbitrarias: las suites HTTP y navegador complementan esa comprobación.

## Verificación final

| Verificación local | Resultado |
| --- | --- |
| Backend | npm ci, npm audit (0 vulnerabilidades), lint, typecheck, build y 175 pruebas en 36 suites, verdes. |
| Web | npm ci, npm audit (0 vulnerabilidades), lint, 23 pruebas y build, verdes. |
| Móvil | npm ci, gate de auditoría (0 vulnerabilidades y sin excepciones), 14 pruebas de app + 5 del gate, tsc y export Android, verdes. |
| ETL | 5 pruebas con unittest, verdes. |
| MySQL 8.4 | 70 pruebas: 67 de integración y 3 recorridos Chromium con API/DB reales, verdes. |
| SQL Server 2022 | 67 pruebas de integración, verdes. |
| PowerShell local | 9 scripts parseados correctamente. La estructura/retención requiere Junction de Windows y se comprueba en CI nativa; el intento local en Linux no certifica esa parte. |
| Consistencia | Versiones 1.18.3, enlaces, baseline/migraciones espejo y 159 llamadas frente a 151 rutas, verdes. |

Lint de backend: cero errores; las 514 advertencias restantes pertenecen a mocks de pruebas. La ejecución separada sobre código productivo termina sin advertencias. No se relajaron reglas.

Carga aislada: 100 alumnos, 900 notas y tres capturas concurrentes. P95 de captura: 522 ms MySQL y 1346 ms SQL Server; consulta de analítica 19/104 ms y resumen de cierre 15/28 ms. Importación de 500 alumnos: confirmación 40421/41192 ms. Son mediciones del entorno de prueba, no un SLA institucional.

La [CI](https://github.com/Marcor360/Sistema-Escolar/actions/workflows/ci.yml) debe verificarse para el SHA exacto publicado en main; la evidencia de otro commit no se transfiere a esta versión. No se desactivan strict, strictNullChecks, lint, pruebas ni DB_SYNC=false. Las integraciones instalan el baseline y aplican las migraciones en bases nuevas aisladas; no se recrean bases existentes.

## Esquema y migraciones

No hay diferencias físicas nuevas ni migraciones creadas. Baseline, schema.sql y archivos de migraciones existentes permanecen intactos. La corrección CHAR/VARCHAR describe los tipos físicos ya existentes. La limpieza de logos reutiliza `archivos_limpieza`.

## Límites pendientes de certificación externa

- No se dispone todavía de staging Windows Server autorizado ni de dispositivos físicos para certificar IIS/HTTPS, build firmado, retorno Openpay, red móvil y recepción push.
- Parseo y estructura de scripts no sustituyen una instalación, backup/restore real o pruebas de servicios en Windows Server.
- SMTP y Openpay reales/sandbox requieren sus configuraciones autorizadas. Las pruebas automatizadas no certifican buzones ni proveedores externos.
- El ETL histórico completo exige el esquema real de certweb. Estas pruebas usan cursores simulados; no certifican una importación institucional. Las cuentas importadas anteriormente sin rol requieren auditoría explícita.
- Accesibilidad y cargas automatizadas cubren escenarios concretos; falta la revisión completa con tecnologías asistivas y volúmenes institucionales.

Por ello esta versión no declara PILOTO LISTO.

## Inventario de archivos
- `.github/workflows/ci.yml`
- `README.md`
- `backend/.env.example`
- `backend/package-lock.json`
- `backend/package.json`
- `backend/src/academico/academico.dto.ts`
- `backend/src/academico/ciclos.service.ts`
- `backend/src/academico/grupos.service.ts`
- `backend/src/academico/materias.service.ts`
- `backend/src/actividades/actividades.dto.ts`
- `backend/src/alumnos/alumnos.dto.ts`
- `backend/src/common/contratos-validacion.spec.ts`
- `backend/src/common/exigir-cambios.ts`
- `backend/src/common/opcional-no-nulo.ts`
- `backend/src/configuracion/configuracion.module.ts`
- `backend/src/configuracion/configuracion.service.spec.ts`
- `backend/src/configuracion/configuracion.service.ts`
- `backend/src/docentes/docentes.dto.ts`
- `backend/src/entities/cobranza-envio.entity.ts`
- `backend/src/entities/configuracion-marca.entity.ts`
- `backend/src/finanzas/conceptos.service.ts`
- `backend/src/finanzas/finanzas.dto.ts`
- `backend/src/notificaciones/notificaciones.controller.ts`
- `backend/src/notificaciones/notificaciones.dto.ts`
- `backend/src/notificaciones/notificaciones.service.ts`
- `backend/src/planteles/planteles.dto.ts`
- `backend/src/reportes/reportes.module.ts`
- `backend/src/reportes/reportes.service.ts`
- `backend/src/usuarios/usuarios.dto.ts`
- `backend/test/integration/barrido.cases.ts`
- `backend/test/integration/baseline.cases.ts`
- `docs/API.md`
- `docs/BARRIDO_GENERAL_1.18.3.md`
- `docs/ESTADO_IMPLEMENTACION.md`
- `docs/REGLAS_PILOTO.md`
- `etl/README.md`
- `etl/etl/load.py`
- `etl/tests/test_load.py`
- `mobile/app.json`
- `mobile/package-lock.json`
- `mobile/package.json`
- `mobile/src/api/client.test.ts`
- `mobile/src/api/client.ts`
- `mobile/src/api/config.test.ts`
- `mobile/src/api/config.ts`
- `scripts/check-project-consistency.cjs`
- `web/package-lock.json`
- `web/package.json`
- `web/src/api/client.test.ts`
- `web/src/api/client.ts`
- `web/src/pages/Calendario.test.tsx`
- `web/src/pages/Calendario.tsx`
- `web/src/pages/Materias.test.tsx`
- `web/src/pages/Materias.tsx`
- `web/src/utils/formato.test.ts`
- `web/src/utils/formato.ts`
