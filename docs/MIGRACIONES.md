# Proceso de migraciones de base de datos

## Reglas

- `DB_SYNC=false` en todos los entornos compartidos y productivos.
- `schema.sql` es solo paridad documental; no es un instalador y no se ejecuta completo.
- Cada cambio de tablas/índices requiere entidad TypeORM y scripts incrementales equivalentes en `database/mysql/` y `database/sqlserver/`.
- Las migraciones SQL actuales son manuales y de una sola ejecución. No existe todavía un ejecutor ni un registro automático en la base.

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
- `migracion_bitacora_resultado.sql` agrega resultado HTTP y entidad a bitácoras ya existentes; en una base recién creada `schema.sql` ya incluye esas columnas.
- `migracion_configuracion_marca.sql`, `migracion_grupos_ciclo_vida.sql`, `migracion_indices.sql` y `migracion_legacy_id.sql` no declaran dependencias entre sí, pero se deben validar contra la versión real del esquema antes de aplicar.

Las migraciones históricas que agregan columnas o índices no son idempotentes. No se deben volver a ejecutar si ya se aplicaron. En SQL Server, los `GO` se deben procesar con `sqlcmd` o una herramienta compatible; no enviar el archivo entero como una sola consulta de aplicación.

## Base vacía

`docker-compose.yml` puede crear la base vacía `escolar`, pero `DB_SYNC=false` no crea tablas. El repositorio aún no contiene un baseline de instalación inicial ejecutable para una base vacía; las migraciones actuales son incrementales y presuponen una versión previa del esquema. Antes del primer despliegue se necesita definir y revisar un baseline versionado para ambos motores, respetando entidades TypeORM y sin ejecutar `schema.sql` completo. `npm run seed` requiere las tablas ya instaladas.

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

El repositorio todavía no tiene tabla de control de migraciones ni automatización de avance/rollback. Por tanto, el registro de archivos aplicados debe mantenerse en el procedimiento de operación hasta que se implemente un runner transaccional adecuado para cada motor.
