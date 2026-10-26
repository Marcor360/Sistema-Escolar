---
name: iua-arquitectura-contexto
description: Mapear la arquitectura, dependencias y contratos vigentes del Sistema Escolar IUA antes de implementar, auditar o revisar módulos.
---
# Contexto técnico IUA

## Cuándo usar
Al comenzar una tarea nueva, ante cambios transversales, o cuando se pide explicar cómo funciona el sistema y cuáles son los límites actuales.

## Secuencia
1. Leer primero `AGENTS.md`, `README.md`, `docs/ESTADO_IMPLEMENTACION.md` y `docs/ARQUITECTURA.md`; contrastar con archivos actuales, no asumir que un documento histórico sigue vigente.
2. Ubicar el flujo real en `backend/src`, `web/src`, `mobile/src`, `database` y `scripts`; identificar controlador, servicio, entidad, DTO, guard, cliente, pruebas y rutas.
3. Usar `docs/MATRIZ_ACCESO.md` para diferenciar SUPERADMIN, ADMINISTRATIVO, FINANZAS, MAESTRO y ALUMNO. Expo es solo para ALUMNO. Toda regla de negocio reside en NestJS y se aplica en servidor.
4. Distinguir explícitamente implementado, propuesto, aprobado por la institución, verificado en CI, comprobado en staging y desplegado. Ninguno implica automáticamente el siguiente.
5. Identificar dependencias de MySQL y SQL Server; comprobar `database/baseline-manifest.json` para cambios estructurales.

## Entrega
Presentar mapa de archivos con rutas, flujo de datos, contratos y riesgos, además de lagunas de evidencia. Citar ruta y función concretas de hallazgos; marcar «no verificado» lo que no fue ejecutado. No modificar código, versiones o datos por el mero hecho de explorar.
