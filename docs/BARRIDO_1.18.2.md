# Barrido de código y correcciones 1.18.2

Fecha: 8 de octubre de 2026. Baseline revisado: `5951136ad57f921f64aaaa12b6f655a19d9b7b93` (1.18.1). La versión final se identifica con el commit titulado `1.18.2`; consultar la CI del SHA exacto en GitHub Actions.

## Alcance y evidencia

Se revisaron autenticación y sesiones, roles y alcance, expedientes y transiciones, ciclos, inscripciones, actividades, calificaciones, reportes, finanzas y webhooks, conducta, calendario, archivos, notificaciones, importaciones y analítica. También se revisaron la sesión y consultas de los clientes web/móvil y los recorridos automatizados existentes. La revisión combinó lectura estática, reproducciones dirigidas y suites automatizadas; no certifica ausencia absoluta de bugs.

| Hallazgo | Evidencia y corrección |
| --- | --- |
| Paginación financiera con error 500 | Adeudos y órdenes con joins/skip/take usaban nombres físicos en orderBy. Reproducción: `Cannot read properties of undefined (reading 'databaseName')`. Se usan propiedades TypeORM y desempate por ID; regresión HTTP con alcance financiero en ambos motores. |
| Nombres Unicode en descargas | validateHeaderValue rechazaba nombres como `tarea-数学.pdf` con ERR_INVALID_CHAR. Encabezado central RFC 5987, alternativa ASCII y eliminación de controles/rutas. Se conserva nombre UTF-8 recibido por multipart y se verifica descarga real y tres casos unitarios. Reportes usan el mismo constructor. |
| Límite de subida capturado antes del .env | Importar uploadConfig antes de establecer MAX_UPLOAD_MB=12 mantenía 5 MB. Lectura perezosa al crear Multer y prueba con límites 12, 2 y 5 MB. |
| Incremento perdido de revocación | Dos cambios simultáneos de contraseña dejaban sessionVersion=1, cuando deben incrementar dos veces; la regresión falló antes del arreglo. Incremento atómico en cambio/restablecimiento, condición de cuenta activa y orden consistente de bloqueos. |
| Filtro de plantel ignorado para docente multisede | La rama docente aplicaba clases propias pero omitía el plantel solicitado. Ahora se intersectan ambos filtros; regresión con dos planteles, grupos y alumnos. |
| Eventos para grupos de ciclo cerrado | Crear evento solo validaba existencia/actividad del grupo. Se aplica la regla central de grupo configurable y una prueba exige rechazo 409 tras cerrar ciclo. |

Refuerzos preventivos: edición de usuarios con bloqueo de fila para evitar escrituras obsoletas frente a bajas/cambios de contraseña; prueba concurrente comprueba que la cuenta permanece inactiva. Los errores del stream de descarga se manejan para que un archivo retirado durante la lectura no produzca una excepción sin manejar. Estas medidas no se presentan como una reproducción previa de caída en producción.

## Verificación

- Backend: npm ci, npm audit (0 vulnerabilidades), lint (sin errores; avisos solo en mocks), typecheck, build y 171 pruebas unitarias en 35 suites.
- Web: npm ci, npm audit (0 vulnerabilidades), lint, 17 pruebas en 8 archivos y build.
- Móvil: npm ci, auditoría controlada sin vulnerabilidades, 8 pruebas de aplicación + 5 de la política de auditoría, TypeScript y exportación Android.
- ETL: 3 pruebas unittest aprobadas.
- Windows: análisis sintáctico de 9 scripts PowerShell en este entorno; los checks funcionales sobre Windows real corresponden al job windows-scripts de CI.
- MySQL 8.4: 65 casos aprobados con DB_SYNC=false, incluidos 3 recorridos Chromium; base nueva aislada escolar_integration_barrido_20261008c.
- SQL Server 2022: 62 casos aprobados con DB_SYNC=false; base nueva aislada con el mismo nombre en el otro motor.
- Carga aislada: 100 alumnos/900 notas/3 capturas concurrentes; P95 de captura 371 ms MySQL y 1299 ms SQL Server. Importación 500 alumnos: confirmación 37397 ms y 39025 ms respectivamente. Son medidas de este entorno de prueba, sin SLA institucional.
- CI del commit final: comprobar enlace del SHA en GitHub Actions; los ocho jobs son obligatorios antes de comunicar cierre.

No se desactivaron strict, strictNullChecks, strictPropertyInitialization, lint, pruebas ni DB_SYNC=false. No se modificaron entidades, DDL, baseline o migraciones; **no hay migraciones nuevas**. Paquetes, lockfiles, Expo y README declaran 1.18.2.

## Límites y pendientes externos

La CI y las bases aisladas no certifican Windows Server/IIS/HTTPS institucional, backup restaurado, SMTP real, Openpay sandbox, entrega push/EAS/FCM/APNs o dispositivos físicos. El ETL histórico requiere el esquema certweb sanitizado. No se declara PILOTO LISTO. Se mantienen los pendientes de operación documentados y la necesidad de pruebas con datos/volumen institucionales. Los avisos any restantes pertenecen a mocks de pruebas; no se relajaron reglas productivas.

## Inventario completo

- `README.md`
- `backend/package-lock.json`
- `backend/package.json`
- `backend/src/archivos/archivos.service.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/calendario/calendario.service.ts`
- `backend/src/common/content-disposition.spec.ts`
- `backend/src/common/content-disposition.ts`
- `backend/src/common/upload.config.spec.ts`
- `backend/src/common/upload.config.ts`
- `backend/src/conducta/conducta.service.ts`
- `backend/src/finanzas/cargos.service.ts`
- `backend/src/finanzas/ordenes.service.ts`
- `backend/src/reportes/reportes.service.ts`
- `backend/src/usuarios/usuarios.service.spec.ts`
- `backend/src/usuarios/usuarios.service.ts`
- `backend/test/critical-flows.integration-spec.ts`
- `backend/test/integration/archivos.cases.ts`
- `backend/test/integration/barrido.cases.ts`
- `backend/test/integration/recorrido-academico.ts`
- `docs/BARRIDO_1.18.2.md`
- `mobile/app.json`
- `mobile/package-lock.json`
- `mobile/package.json`
- `web/package-lock.json`
- `web/package.json`
