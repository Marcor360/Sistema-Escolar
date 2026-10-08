# ETL certweb → Sistema Escolar

Migra datos desde la base legacy certweb (SQL Server) hacia el nuevo Sistema Escolar,
como parte de la estrategia *strangler fig* (Mes 6 del contrato). Los upserts de
planteles y alumnos usan `legacy_id` para reconocer altas y actualizaciones. El mapeo
del origen sigue pendiente de confirmar contra el esquema real de certweb.

## Requisitos

- Python 3.11+
- `pymssql` para la lectura de certweb y, si el destino es SQL Server, ODBC Driver 17
  para `pyodbc`; para destino MySQL se usa `mysql-connector-python`
- `pip install -r requirements.txt`
- Copiar `.env.example` a `.env` y llenar `LEGACY_DB_*` (certweb) y `TARGET_DB_*`
  (destino; `TARGET_DB_ENGINE=mysql` o `sqlserver`)

Las cargas al destino adaptan marcadores e identificadores generados para MySQL y
SQL Server. La prueba local cubre el SQL generado con cursores simulados; aún se
requiere validar ambas rutas contra instancias reales antes de migrar datos.

## Orden de ejecución

Respeta las dependencias entre entidades:

```
planteles → usuarios → docentes/alumnos → ciclos → materias → grupos
```

Hoy solo **planteles** y **alumnos** tienen código de extract, transform y load; el
extract usa nombres de referencia y no está validado contra una instancia real de
certweb. Usuarios, docentes y grupos todavía no tienen pipeline implementado.

## Uso

```bash
# Modo por defecto: solo imprime el resumen, no escribe nada.
python -m etl.run --entidad planteles
python -m etl.run --entidad alumnos

# Aplica los cambios contra la base destino.
python -m etl.run --entidad planteles --aplicar
python -m etl.run --entidad alumnos --aplicar
```

Cada alumno nuevo recibe el rol ALUMNO dentro de la misma transacción que su usuario y expediente. El catálogo de roles debe estar configurado previamente. Si falla una fila se revierte el lote completo; no queda un usuario sin expediente ni un alumno sin rol. Las bases ya cargadas con versiones anteriores requieren revisar las cuentas sin rol antes de habilitar acceso.

El resumen reporta altas, actualizaciones y registros omitidos (por ejemplo, un alumno
cuyo plantel legacy aún no se ha migrado).

## Reglas

- Ningún `DELETE` contra la base destino, nunca.
- Los `usuarios` migrados reciben un hash bcrypt de una contraseña aleatoria — nunca se
  migran hashes legacy. El flujo real para el usuario migrado es "olvidé mi contraseña".
- `extract.py` solo hace `SELECT` contra certweb.
- Los nombres de tabla/columna en `extract.py` son de referencia; deben ajustarse al
  esquema real de certweb antes de usarse contra un entorno productivo.
- Pruebas del adaptador de carga: `python -m unittest discover -s etl/tests -v`.
- GitHub Actions ejecuta estas pruebas con Python 3.11; las pruebas no conectan con bases reales.

El CLI cierra ambas conexiones al fallar un pipeline y cierra el origen si no logra abrir el destino. Los drivers y dotenv se cargan al ejecutar su operación, de modo que `--help` y las pruebas con conexiones simuladas no requieren motores ni credenciales. Esto no certifica una importación real de certweb.
