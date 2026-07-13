# ETL certweb → Sistema Escolar

Migra datos desde la base legacy certweb (SQL Server) hacia el nuevo Sistema Escolar,
como parte de la estrategia *strangler fig* (Mes 6 del contrato). Es idempotente: cada
entidad se vincula por `legacy_id` y correr el ETL varias veces solo genera altas para
lo que falta y actualizaciones para lo que cambió.

## Requisitos

- Python 3.11+
- Driver ODBC 17 para SQL Server (lectura de certweb y, si el destino es SQL Server,
  también para escribir)
- `pip install -r requirements.txt`
- Copiar `.env.example` a `.env` y llenar `LEGACY_DB_*` (certweb) y `TARGET_DB_*`
  (destino; `TARGET_DB_ENGINE=mysql` o `sqlserver`)

## Orden de ejecución

Respeta las dependencias entre entidades:

```
planteles → usuarios → docentes/alumnos → ciclos → materias → grupos
```

Hoy solo **planteles** y **alumnos** tienen el pipeline completo (extract, transform y
load); el resto de entidades levanta `NotImplementedError` explícito en su función de
extracción hasta que se mapeen contra el esquema real de certweb.

## Uso

```bash
# Modo por defecto: solo imprime el resumen, no escribe nada.
python -m etl.run --entidad planteles
python -m etl.run --entidad alumnos

# Aplica los cambios contra la base destino.
python -m etl.run --entidad planteles --aplicar
python -m etl.run --entidad alumnos --aplicar
```

El resumen reporta altas, actualizaciones y registros omitidos (por ejemplo, un alumno
cuyo plantel legacy aún no se ha migrado).

## Reglas

- Ningún `DELETE` contra la base destino, nunca.
- Los `usuarios` migrados reciben un hash bcrypt de una contraseña aleatoria — nunca se
  migran hashes legacy. El flujo real para el usuario migrado es "olvidé mi contraseña".
- `extract.py` solo hace `SELECT` contra certweb.
- Los nombres de tabla/columna en `extract.py` son de referencia; deben ajustarse al
  esquema real de certweb antes de usarse contra un entorno productivo.
