# Proceso de migraciones de base de datos

## Reglas

- `DB_SYNC=false` en todos los entornos compartidos y productivos.
- `schema.sql` es solo paridad documental; no es un instalador y no se ejecuta completo.
- Cada cambio de tablas/índices requiere entidad TypeORM y scripts incrementales equivalentes en `database/mysql/` y `database/sqlserver/`.
- El backend incluye un runner manual `db:migrate` y una tabla `schema_migrations` por base. El runner toma el orden explícito de `database/baseline-manifest.json`, ejecuta solo archivos pendientes y conserva `DB_SYNC=false`. Ejecuta una instancia a la vez; las migraciones de DDL no tienen rollback automático.

## Secuencia de preparación

1. Confirmar motor, versión, nombre de base, alcance y ventana de mantenimiento.
2. Respaldar la base y comprobar que el respaldo se puede restaurar en un entorno aislado.
3. Ensayar los scripts aplicables sobre una copia de la base y revisar errores antes de producción.
4. Para `migracion_pago_orden_unico.sql`, comprobar primero pagos repetidos por `orden_pago_id`; cualquier caso debe conciliarse financieramente antes de crear el índice. No borrar pagos automáticamente.
5. Aplicar cada archivo una sola vez con el cliente oficial del motor, conservando el orden de dependencias indicado abajo.
6. Verificar columnas, índices, restricciones y arranque de la API con `DB_SYNC=false`.
7. Registrar fuera del repositorio el archivo, motor, base, fecha, responsable, respaldo y resultado. No guardar contraseñas ni datos personales en ese registro.

## Dependencias conocidas

- `migracion_planteles_alcance.sql` debe preceder a `migracion_plantel_detalle.sql`.
- `migracion_calendario_creador.sql` debe ejecutarse después de `migracion_plantel_detalle.sql`.
- `migracion_pago_orden_unico.sql` requiere que exista `pagos.orden_pago_id`; se recomienda ejecutarla después de comprobar y resolver duplicados.
- `migracion_cargos_idempotencia.sql` agrega una clave nullable y un índice único para evitar colegiaturas duplicadas concurrentes; no modifica cargos existentes.
- `migracion_version_sesion.sql` agrega `usuarios.session_version`, que la API usa para revocar JWT después de cambios de contraseña.
- `migracion_bitacora_resultado.sql` agrega resultado HTTP y entidad a bitácoras ya existentes; en una base recién creada `schema.sql` ya incluye esas columnas.
- `migracion_bitacora_plantel.sql` agrega el ámbito institucional a la bitácora financiera; los eventos previos conservan `plantel_id=NULL` y solo quedan visibles para `SUPERADMIN`.
- `migracion_grupos_plantel_unique.sql` permite repetir nombres de grupo entre planteles del mismo ciclo. Agrega primero la nueva clave única y después retira la anterior; si hay duplicados de ciclo/plantel/nombre, la primera operación falla y conserva la restricción antigua. Ejecutar tras revisar el esquema real.
- `migracion_configuracion_marca.sql`, `migracion_grupos_ciclo_vida.sql`, `migracion_indices.sql` y `migracion_legacy_id.sql` no declaran dependencias entre sí, pero se deben validar contra la versión real del esquema antes de aplicar.

Las migraciones históricas que agregan columnas o índices no son idempotentes. No se deben volver a ejecutar si ya se aplicaron. En SQL Server, los `GO` se deben procesar con `sqlcmd` o una herramienta compatible; no enviar el archivo entero como una sola consulta de aplicación.

## Base vacía

Para una instalación nueva, crear primero una base vacía con el nombre aprobado y ejecutar exactamente una vez `database/mysql/baseline_v1.sql` o `database/sqlserver/baseline_v1.sql` según el motor. Son snapshots versionados y no crean ni seleccionan bases por su cuenta. Después compilar el backend y ejecutar `npm run db:migrate:adopt` con `DB_MIGRATION_BASELINE=v1`; esto solo registra el baseline y las migraciones que el manifest declara incluidas, no cambia el esquema. Confirma antes que la base corresponda a ese baseline. Luego `npm run db:migrate:status` muestra los pasos pendientes y `npm run db:migrate` los aplica. La migración de unicidad por plantel aparece como pendiente. Antes, comprobar duplicados con `SELECT ciclo_id, plantel_id, nombre, COUNT(*) FROM grupos GROUP BY ciclo_id, plantel_id, nombre HAVING COUNT(*) > 1;`. Si devuelve filas, resolverlas manualmente con el responsable de datos; no borrar ni combinar grupos automáticamente. `schema.sql` permanece como referencia documental; nunca se usa como instalador. `npm run seed` requiere que el baseline haya terminado correctamente y `ALLOW_DEV_SEED=true`; se bloquea en producción.

La suite de integración instala cada baseline en una base aislada con prefijo `escolar_integration_`, exige que no tenga tablas, agrega un fixture previo y ejecuta `db:migrate:adopt`, `db:migrate` y `db:migrate:status` con `DB_SYNC=false`. Después comprueba que el grupo existente permanece, que el mismo nombre se acepta en dos planteles y se rechaza al repetirlo dentro del mismo plantel. Esto cubre la ruta del runner en MySQL y SQL Server en CI; no valida la actualización de una base institucional histórica. En este entorno local no hay Docker ni servicios en 3306/1433. `db:migrate:adopt` marca como aplicadas las entradas de `incluye` y no comprueba el contenido real de la base; no lo uses sin confirmar la paridad.

## Aplicación manual

MySQL, desde una terminal POSIX con cliente instalado:

```sh
mysql --host=<host> --port=<puerto> --user=<usuario> --password <base> < database/mysql/migracion_pago_orden_unico.sql
```

SQL Server, con `sqlcmd` y una conexión protegida:

```sh
sqlcmd -S <servidor> -d <base> -U <usuario> -i database/sqlserver/migracion_pago_orden_unico.sql
```

Reemplazar el archivo por la migración pendiente que corresponda. No incluir contraseñas en comandos guardados, historiales compartidos o scripts versionados. Los ejemplos muestran solo la nueva migración; para las históricas aplica el mismo proceso y respeta las dependencias.

## Límite actual

El runner no aplica baselines, no deduce el historial de una base antigua y no ofrece rollback. La adopción de una base existente requiere auditoría manual. Los scripts MySQL pueden confirmar DDL antes del registro; si un archivo falla a mitad, inspeccionar el esquema y corregirlo manualmente antes de volver a ejecutar. No ejecutar dos instancias del runner a la vez.
