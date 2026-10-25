# Catálogo institucional de Finanzas · 25/oct/2026 (versión 1.27.42)

Se incorpora la lista proporcionada de **37 conceptos**, claves de texto `001`–`037` (con ceros a la izquierda). Las filas 038–040 están vacías y no se registran. Los nombres se normalizan con acentuación en español, conservando el texto «CREDENCIAL ESTUDIANTIL CREDENCIAL» de la clave 024 según el origen.

| Clave | Concepto | Tipo de registro |
| --- | --- | --- |
| 001 | INSCRIPCIÓN | INSCRIPCION |
| 002 | REINSCRIPCIÓN | INSCRIPCION |
| 003 | REINCORPORACIÓN | OTRO |
| 004 | EQUIVALENCIA | OTRO |
| 005 | COLEGIATURA DE ENERO | COLEGIATURA |
| 006 | COLEGIATURA DE FEBRERO | COLEGIATURA |
| 007 | COLEGIATURA DE MARZO | COLEGIATURA |
| 008 | COLEGIATURA DE ABRIL | COLEGIATURA |
| 009 | COLEGIATURA DE MAYO | COLEGIATURA |
| 010 | COLEGIATURA DE JUNIO | COLEGIATURA |
| 011 | COLEGIATURA DE JULIO | COLEGIATURA |
| 012 | COLEGIATURA DE AGOSTO | COLEGIATURA |
| 013 | COLEGIATURA DE SEPTIEMBRE | COLEGIATURA |
| 014 | COLEGIATURA DE OCTUBRE | COLEGIATURA |
| 015 | COLEGIATURA DE NOVIEMBRE | COLEGIATURA |
| 016 | COLEGIATURA DE DICIEMBRE | COLEGIATURA |
| 017 | CUATRIMESTRE COMPLETO | OTRO |
| 018 | ANUALIDAD | OTRO |
| 019 | GRADO ACADÉMICO COMPLETO | OTRO |
| 020 | CONSTANCIA DE ESTUDIOS | OTRO |
| 021 | CONSTANCIA DE ESTUDIOS URGENTE | OTRO |
| 022 | CONSTANCIA ESPECIAL | OTRO |
| 023 | CONSTANCIA RENOVACIÓN DE BECA | OTRO |
| 024 | CREDENCIAL ESTUDIANTIL CREDENCIAL | OTRO |
| 025 | CREDENCIAL ESTUDIANTIL ANUAL | OTRO |
| 026 | HISTORIAL ACADÉMICO POR CUATRIMESTRE | OTRO |
| 027 | HISTORIAL ACADÉMICO POR SEMESTRE | OTRO |
| 028 | SERVICIO SOCIAL | OTRO |
| 029 | PRÁCTICAS PROFESIONALES | OTRO |
| 030 | EXAMEN EXTRAORDINARIO | OTRO |
| 031 | MATERIA LIBRE | OTRO |
| 032 | REIMPRESIÓN DE BOLETA | OTRO |
| 033 | GASTOS ADMINISTRATIVOS | OTRO |
| 034 | CAMBIO DE TURNO | OTRO |
| 035 | CAMBIO DE CARRERA | OTRO |
| 036 | BAJA TEMPORAL | OTRO |
| 037 | BAJA DEFINITIVA | OTRO |

## Persistencia y operación

- Migraciones de datos espejo `database/mysql/migracion_conceptos_finanzas_institucionales.sql` y `database/sqlserver/migracion_conceptos_finanzas_institucionales.sql`, registradas en `database/baseline-manifest.json`. Las altas se hacen exclusivamente si la clave no existe. **No se renombran ni actualizan conceptos existentes**, tampoco sus montos, estados ni relaciones con cargos/pagos.
- Los conceptos nuevos se crean **activos**, con `monto_base = 0.00` y `aplica_recargo = false`: no se recibió lista de precios ni autorización de política de morosidad. Finanzas debe determinar y cargar la tarifa de cada uno; el API exige monto positivo para crear cargos individuales. Registrar el concepto **no crea ni cobra cargos automáticamente**.
- Se conservan los conceptos heredados `INS` y `COL` y sus referencias porque los flujos actuales de inscripción y generación masiva de colegiaturas dependen de esas claves. `001` y `005`–`016` **no sustituyen** tales claves sin un rediseño explícito.
- Las colegiaturas mensuales `005`–`016` se tipan `COLEGIATURA` y se muestran en el catálogo, pero **el formulario de cargos adicionales las excluye**; la generación masiva continúa con `COL`. No habilitar otro canal de colegiaturas sin controles de periodo e idempotencia para evitar doble cobro.
- La clave `024` parece redundante en el listado original, y su nombre se conserva literalmente. Finanzas debe confirmar si corresponde corregirla mediante su pantalla de edición en una operación autorizada.
- Los conceptos financieros son de alcance institucional y el CRUD existente está restringido al rol `FINANZAS`; la gestión de cargos respeta los planteles autorizados. La aplicación Expo del alumno no incorpora módulos administrativos.

## Validación antes del despliegue

1. Verificar respaldos y ensayar migraciones en bases aisladas MySQL y SQL Server; ejecutar `npm run db:migrate:status` antes y después y comprobar `001`–`037` sin cambios en claves previas.
2. Comprobar `GET /api/finanzas/conceptos` y la tabla en Finanzas. Crear un cargo de prueba con un concepto `OTRO` tras fijar importe positivo, verificar estado de cuenta, anular mediante flujo auditado y comprobar aislamiento por plantel.
3. Confirmar que `COL` genera colegiaturas masivas como antes y que `005`–`016` no aparecen en «Asignar cargo adicional». Revisar con el área institucional precios, recargos y descripción de la clave `024`.
4. No ejecutar `database/*/seed.sql` sobre instalaciones existentes ni activar `DB_SYNC`. El merge del PR no despliega en IIS.
