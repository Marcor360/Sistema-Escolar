# Estabilización de la auditoría — 1.18.0

8 de octubre de 2026. Entrega por etapas: 1.16.1 (seguridad), 1.17.0 (refactor/configuración) y 1.18.0 (rendimiento, contratos y accesibilidad). No constituye certificación del piloto.

## Cambios

- Capacidades por operación centralizadas. MAESTRO+FINANZAS conserva alcance de sus clases en operaciones académicas y obtiene su alcance financiero independientemente. FINANZAS solo no consulta calendario ni calificaciones. Matriz de seis combinaciones de roles en ambos motores.
- Promoción bloquea y revalida ciclos, plantel, grupos y alumnos. Conflictos/deadlocks se traducen a 409, con rollback completo. Regresiones de promoción frente a desactivación e inscripción manual, reactivación frente a baja y captura frente a cierre de parcial.
- AcademicoService queda como fachada; ciclos, materias, grupos e inscripciones tienen servicios separados. Suite HTTP dividida en once dominios con bootstrap común y orden conservado.
- Finanzas tiene paneles separados de cargos, pagos y adeudos. Alumnos separa alta/edición, historial y transferencia. Grupos separa materias e inscripciones; el formulario de alta/edición permanece en la página. Maestro separa actividades, materiales y entregas. Se conservan etiquetas, selección paginada, coordinación e idempotencia.
- Validación central del entorno antes de construir providers. Credenciales y conexión explícitas; producción/staging mantienen TLS y HTTPS. Los jobs de integración declaran UPLOADS_DIR y no cargan el archivo .env local.
- Resumen de cierre selecciona solo columnas necesarias y usa mapas/conjuntos para inscritos, notas y periodos; evita barridos anidados sobre todas las notas.
- Importaciones precargan catálogos, duplicados y alcance por lote, y hacen bcrypt fuera de la transacción. Inserciones/actualizaciones y bitácoras se agrupan; confirmación atómica y revalidación dentro de la transacción. Límite de 500 filas conservado.
- Previews de importación persistidos en base: cifrado AES-256-GCM, nonce aleatorio y autenticación ligada a preview/actor/tipo/posición. Dos instancias pueden compartirlos y solo una confirmación los consume. Expiran a los 15 minutos; limpieza cada minuto y al crear previews. Las filas se retiran por cascada al consumir o limpiar.
- Swagger documenta entradas, enums, multipart, respuestas, autorización y errores 400/401/403/404/409 de importación, promoción, conducta y analítica, además de resumen/transiciones de ciclo. Prueba del documento OpenAPI generado.
- strictPropertyInitialization habilitado. Las aserciones de asignación se restringen a propiedades que TypeORM hidrata o DTOs que valida el framework; no cambian SQL ni relajan strictNullChecks/lint.
- Confirmaciones asíncronas accesibles reemplazan todos los confirm() nativos, incluida conciliación. Escape cancela, se devuelve foco y se evita resolver dos veces. La restauración de sesión muestra un estado accesible de carga.

## Migración y operación

Aplicar `migracion_previews_importacion.sql` mediante el runner en MySQL y SQL Server, después de las migraciones anteriores. Agrega `importacion_previews` e `importacion_filas`, FK e índices. Entidades, schemas documentales y manifest se actualizan juntos; baseline v1 permanece intacto. No se recrean bases ni se activa DB_SYNC.

La clave de previews se deriva de JWT_SECRET con un contexto específico. Una rotación del secreto invalida previews pendientes: generar otro archivo/preview. Todas las instancias deben compartir secreto y base. No se almacenan contraseñas del archivo ni se entregan contraseñas nuevas: se requiere activación mediante recuperación o reinicio temporal autorizado. Los previews contienen datos personales cifrados; también proteger base y backups con controles institucionales. La limpieza puede retrasarse durante una caída; al restaurar el servicio se reintenta sin registrar contenido.

Rollback de aplicación: usar la versión anterior y conservar las nuevas tablas; no ejecutar una migración destructiva para retirarlas. Antes de migrar staging, respaldar base/uploads y verificar restauración. La nueva versión exige configuración explícita: revisar ejemplos .env y estado de migraciones antes de arrancar.

## Verificación

La entrega exige npm ci, audit, lint, typecheck/build/tests de backend; ci/audit/lint/tests/build web; ci/audit controlado/tests/typecheck/export Android móvil; unittest ETL; scripts PowerShell; integración completa MySQL 8.4 y SQL Server 2022 con DB_SYNC=false y recorridos reales de Chromium. Resultados locales finales: backend 167 pruebas (33 suites), sin avisos productivos de lint; web 14 pruebas (7 archivos); móvil 8 pruebas más 5 del gate de auditoría, TypeScript y export Android; ETL 3 pruebas. npm ci de los tres clientes y audits sin vulnerabilidades. MySQL pasó 56 casos, incluidos los dos recorridos Chromium; SQL Server pasó 54. Todos los motores usan bases nuevas aisladas, migraciones reales y DB_SYNC=false.

Nueve scripts PowerShell pasaron análisis sintáctico en Linux. La prueba de retención con junctions NTFS no completó en este host Linux; su verificación funcional corresponde al job `windows-scripts` en windows-latest. La CI final debe pasar también ese job.

| Medición sintética | MySQL 8.4 | SQL Server 2022 |
| --- | ---: | ---: |
| Captura concurrente P95 (100 alumnos × 3 clases × P1-P3) | 1.093 ms | 15.272 ms |
| Analítica de las tres clases | 16 ms | 115 ms |
| Resumen de cierre | 18 ms | 29 ms |
| Preview de 500 alumnos | 98 ms | 637 ms |
| Confirmación de 500 alumnos, incluido bcrypt fuera de transacción | 38.245 ms | 39.474 ms |

SQL Server conserva una latencia mayor en captura que debe volver a medirse sobre el host de staging; no se declara equivalencia de rendimiento ni un SLA. Estas pruebas certifican coherencia funcional, atomicidad y alcance bajo la carga indicada.

La carga reproducible usa 100 alumnos, tres clases, 900 notas y tres capturas simultáneas; verifica promedios y resumen de cierre. Otra prueba importa 500 alumnos con auditoría por registro. Son mediciones sobre datos sintéticos y esta máquina, no capacidad/SLA del servidor institucional.

## Pendientes externos o condicionales

- Servidor Windows/IIS/HTTPS, SMTP real, Openpay sandbox, push real/FCM/APNs y dispositivos físicos firmados requieren acceso/configuración institucional; todavía no certificados.
- Certweb histórico requiere esquema real sanitizado. No se inventan mapeos.
- Caché móvil persistente offline queda condicionada a política de privacidad/retención y pérdida de dispositivo. No se encolan pagos ni entregas automáticamente.
- Pruebas de contraste, lector de pantalla y dispositivos físicos siguen en el gate de staging; Chromium automatizado no las reemplaza.

Inventario completo de archivos de esta auditoría: [ARCHIVOS_AUDITORIA_1.18.0.md](ARCHIVOS_AUDITORIA_1.18.0.md). La CI debe verificarse para el SHA exacto de main; no basta el resultado de una versión anterior.
