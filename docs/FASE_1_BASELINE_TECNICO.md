# Fase 1 — Recuperación del baseline técnico

Candidato: **1.14.0**. Base local y `main` remoto comprobados antes de modificar:
`7edce9a82e284dda8727eff7f31a980e32ad4d10` (7 de octubre de 2026).

## Reparación

Se revisaron las 28 entidades, README, AGENTS, configuración TypeScript/ESLint,
plantillas de entorno, CI y ambos directorios de DDL. Las propiedades anulables
sin tipo SQL emitían metadata `Object` al activar `strictNullChecks`.
Se declaran explícitamente tipos en 51 columnas: `String` conserva `VARCHAR` en
MySQL y `NVARCHAR` en SQL Server, `int` conserva las claves/números y `Date`
explicita las fechas de baja. Las fechas, decimales, texto y bigints ya tipados
conservan sus declaraciones. `Grupo.legacyId` se incorpora a la entidad porque
la columna BIGINT anulable ya existe en ambos baselines y en schema.sql.

No se cambian el DDL, los baselines ni el manifest y **no se crean migraciones**.
Baseline v1 más las tres migraciones pendientes conserva las columnas actuales:
unicidad de grupo por ciclo/plantel/nombre, idempotencia de pagos y
periodos/historial de calificaciones. La integración ahora comprueba todas las
columnas físicas frente a todas las entidades (nombres, nulabilidad, longitudes
y precisión/escala de decimales). La prueba de metadata ejecuta la validación
real de TypeORM con ambos drivers sin conectar.

El runner de migraciones carga `.env` como el resto de la API. No hay cambios en
`strict`, `strictNullChecks`, ESLint o las condiciones `DB_SYNC=false`. El barrido
de producción no encontró `any` explícitos; las 495 advertencias restantes del
backend pertenecen a mocks de tests. No se relajan sus reglas.

Se alinean paquetes, raíces de lockfiles, Expo y documentación a 1.14.0 y se
retiran seis `.pyc` de Git, conservando `__pycache__/` y `*.py[cod]` en .gitignore.

## Audit móvil

SDK 57 propaga los mismos dos avisos permitidos a más dependencias. Se actualiza
la lista cerrada de paquetes transitivos y se añaden cinco pruebas negativas y
positivas del gate. Los IDs/URLs de causa raíz se mantienen exactamente iguales;
un aviso nuevo sigue fallando aun si afecta un paquete de la lista. No se afirma
que las dos vulnerabilidades estén corregidas. Véase EXCEPCIONES_NPM_AUDIT.md.

## Evidencia local

| Verificación | Resultado |
|---|---|
| Backend npm ci/audit/lint/typecheck/build | Pasan; audit sin vulnerabilidades |
| Backend unitarias | 126 pasan, 23 suites |
| Web npm ci/audit/lint/test/build | Pasan; 8 pruebas, audit sin vulnerabilidades |
| Móvil npm ci/gate audit/test/tsc/export Android | Pasan; 4 pruebas móviles + 5 del gate |
| ETL unittest | 3 pasan |
| MySQL 8.4, integración completa | 21 pasan, DB_SYNC=false, base aislada |
| Scripts Windows: parser PowerShell 7.5.4 en Linux | Todos sin errores de sintaxis |
| Scripts Windows: pruebas de Junction/retención en Windows | Job windows-scripts verde en CI |
| SQL Server 2022, integración completa | 21 pasan, DB_SYNC=false, base aislada |

Docker, MySQL y SQL Server funcionan. La imagen oficial de SQL Server redirige a
`centralus.data.mcr.microsoft.com`, que la política inicial rechazaba; tras habilitar acceso de red se descargó y verificó. Se guardó
el dominio requerido en el borrador del entorno junto con `api.github.com`.
La publicación del borrador no se ha realizado y no se asume aplicada.
PowerShell local se descargó de Microsoft/PowerShell y su SHA256 se verificó
contra hashes.sha256 de la release oficial antes de validar scripts.

## Primera CI del candidato

El SHA `066ae7544d130bc4fbe437152580e7a6ad0ac071` se publicó en main y
[su CI](https://github.com/Marcor360/Sistema-Escolar/actions/runs/37648784503)
confirmó web, ETL y Windows. Backend, móvil y ambas integraciones fallaron en
`npm ci` antes de ejecutar los tests. El mismo comando pasa localmente.
Se añade un wrapper que ejecuta exactamente `npm ci`, conserva su código de
salida y publica sus errores como anotaciones de Actions para poder aislar la
causa cuando la red impide descargar los logs. No se omite la instalación.
El diagnóstico mostró un reemplazo accidental de versión en entradas transitivas
de los lockfiles. Se restauran íntegramente desde el commit base y solo se cambian
las versiones raíz; se verifica por comparación estructural que las dependencias,
URLs e integridades sean idénticas al baseline.

## Evidencia de cierre técnico

El SHA `5fa8065a9992a322f8ef2e53761ee06cecc77f08` está en `main` y
[su CI completa](https://github.com/Marcor360/Sistema-Escolar/actions/runs/37649748701)
terminó **success** en los siete jobs: backend, web, móvil, ETL, Windows,
MySQL y SQL Server. Se verificó el resultado por la API de GitHub para ese SHA.
La Fase 1 queda cerrada para ese código. Esta actualización documental también
se somete a CI antes de informar el SHA final de main.

Las Fases 2–5 siguen pendientes. Esta reparación no certifica transiciones de
dominio, refresh rotativo, reportes oficiales, conciliación financiera ni
staging/dispositivos físicos. **PILOTO LISTO no está autorizado por estos resultados.**

## Archivos modificados o retirados

- `README.md`
- `backend/package-lock.json`
- `backend/package.json`
- `backend/src/config/entity-metadata.spec.ts`
- `backend/src/database/migrate.ts`
- `backend/src/entities/alumno.entity.ts`
- `backend/src/entities/bitacora-actividad.entity.ts`
- `backend/src/entities/bitacora-financiera.entity.ts`
- `backend/src/entities/calificacion.entity.ts`
- `backend/src/entities/cargo.entity.ts`
- `backend/src/entities/configuracion-marca.entity.ts`
- `backend/src/entities/docente.entity.ts`
- `backend/src/entities/entrega.entity.ts`
- `backend/src/entities/evento-calendario.entity.ts`
- `backend/src/entities/grupo-materia.entity.ts`
- `backend/src/entities/grupo.entity.ts`
- `backend/src/entities/historial-calificacion.entity.ts`
- `backend/src/entities/materia.entity.ts`
- `backend/src/entities/material.entity.ts`
- `backend/src/entities/orden-pago.entity.ts`
- `backend/src/entities/pago.entity.ts`
- `backend/src/entities/periodo-calificacion.entity.ts`
- `backend/src/entities/plantel.entity.ts`
- `backend/src/entities/usuario.entity.ts`
- `backend/test/critical-flows.integration-spec.ts`
- `docs/ESTADO_IMPLEMENTACION.md`
- `docs/EXCEPCIONES_NPM_AUDIT.md`
- `docs/FASE_1_BASELINE_TECNICO.md`
- `etl/etl/__pycache__/__init__.cpython-314.pyc`
- `etl/etl/__pycache__/config.cpython-314.pyc`
- `etl/etl/__pycache__/extract.cpython-314.pyc`
- `etl/etl/__pycache__/load.cpython-314.pyc`
- `etl/etl/__pycache__/run.cpython-314.pyc`
- `etl/etl/__pycache__/transform.cpython-314.pyc`
- `mobile/app.json`
- `mobile/package-lock.json`
- `mobile/package.json`
- `scripts/check-mobile-audit.cjs`
- `scripts/check-mobile-audit.test.cjs`
- `web/package-lock.json`
- `web/package.json`

- `.github/workflows/ci.yml`
- `scripts/ci-install.cjs`
