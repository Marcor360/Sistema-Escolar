# Remediación de ETL certweb → Sistema Escolar

## Estado comprobado
`etl/etl/extract.py`, `transform.py`, `load.py` y `run.py` forman el prototipo del ETL.
Según `etl/README.md`, solo **planteles** y **alumnos** disponen de extracción, transformación y carga parcial. El esquema de `certweb` es de referencia y sus tablas/columnas no están confirmadas; no se debe adivinar el esquema ni habilitar migración masiva.

## Archivos y fases de implementación
1. **Inventario del origen**, lectura solo `SELECT`: documentar schema real SQL Server, PK/FK, colación, tipos, nulos, fechas, horarios y codificación. No registrar datos personales reales en el repositorio.
2. **Matriz de correspondencia verificable**: `etl/README.md` y nuevo inventario aprobado por Control Escolar; definir mapeo de planteles, identidades, alumnos, docentes, ciclos, planes, materias, grupos, inscripciones, notas, cargos y pagos sin asumir entidades inexistentes.
3. **Orden y dependencias**: planteles → identidades/roles → alumnos/docentes → ciclos/programas → grupos/clases → inscripciones → notas y registros financieros. Los pagos históricos exigen conciliación financiera, no se importan como operaciones activas sin autorización.
4. **Transformación controlada**: normalización y detección de duplicados (correo, CURP y matrícula donde aplique), claves `legacy_id`, conversión de fechas, validación por lote y reporte de rechazos **sanitizado**.
5. **Carga segura a MySQL y SQL Server**: transacciones pequeñas, dry-run predeterminado, checkpoint/reanudación, idempotencia y rollback; nunca borrar datos existentes ni activar `DB_SYNC`.
6. **Conexiones**: TLS validado para origen y destino, credenciales solo por variables privadas, cuentas de mínimo privilegio y exportación cifrada controlada.
7. **Ensayo** en copia restaurada y aislada: conteos origen/destino por entidad, integridad referencial, sumas contables auditadas y muestreo con personal autorizado.
8. **Ejecución piloto y corte**: ventana, backup previo, congelación del origen si procede, métricas RPO/RTO, plan de reversión y aprobación institucional.

## Casos de prueba mínimos
- Filas duplicadas, errores de codificación, pérdida de conexión, fechas nulas, cuentas con doble rol y planteles inconsistentes.
- Dos ejecuciones idénticas no duplican registros ni pagos.
- Cargas de prueba completas MySQL 8.4 y SQL Server 2022 con rollback.
- Se preservan datos sensibles y el historial del sistema anterior.

## Decisiones pendientes
Esquema real de certweb, política de datos históricos, responsables de reconciliación contable y periodo de coexistencia.

## Estado
**Diseño preparatorio**: sin permisos al origen real, sin migraciones ni ejecuciones institucionales. No certifica la migración. El primer trabajo de código debe centrarse en contrato y pruebas del esquema de origen real, no en escribir supuestos.
