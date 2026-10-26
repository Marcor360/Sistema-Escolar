---
name: iua-migraciones-datos
description: Revisar migraciones y consistencia TypeORM IUA en MySQL y SQL Server sin tocar bases existentes ni perder datos.
---
# Migraciones seguras IUA

## Contrato innegociable
- No ejecutar `DROP`, `TRUNCATE`, `schema.sql` completo, `db:migrate:adopt` sobre un historial existente ni `DB_SYNC=true` en entornos compartidos.
- Ninguna operación de escritura en staging/producción sin aprobación operativa, respaldo comprobado, restore ensayado y plan de retroceso.

## Proceso
1. Leer `docs/MIGRACIONES.md`, `docs/ARQUITECTURA.md`, `database/baseline-manifest.json` y entidades TypeORM.
2. Para cada cambio comprobar DTO, entidad, constraints, backfill no destructivo, migración incremental espejo en `database/mysql/` y `database/sqlserver/`, y actualización del manifiesto.
3. Revisar llaves únicas, FKs, transacciones, orden de locks, idempotencia, fechas en `America/Mexico_City` y compatibilidad de motor.
4. Ejecutar en BD desechable `cd backend && npm run test:integration`; en pruebas con migrador, inspeccionar primero `npm run db:migrate:status` y variables de conexión AISLADAS.
5. Calificar riesgos de compatibilidad con datos legados, reversión de código que no revierte DDL, enlaces a uploads y retención de expedientes.

## Entrega
Tabla con motor/archivo, forward migration, precondiciones, pruebas y evidencia. Indicar expresamente cuándo no se verificó una restauración ni un historial real.
