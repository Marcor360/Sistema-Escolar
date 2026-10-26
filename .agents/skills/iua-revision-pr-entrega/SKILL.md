---
name: iua-revision-pr-entrega
description: Revisar pull requests de IUA con controles de calidad, versionado SemVer, evidencia CI/UAT y seguridad de despliegue Windows/IIS.
---
# Revisión técnica y entrega de PRs

## Antes de proponer o fusionar
1. Leer `AGENTS.md`, `docs/VERSIONADO_PR.md`, `docs/ESTADO_IMPLEMENTACION.md` y comprobar estado real de `main`, SHAs y PRs. No reservar versiones por número de PR.
2. Evaluar diseño, regresiones, impacto en API/web/Expo, permisos, privacidad, base de datos, migraciones espejadas y compatibilidad de cliente instalado.
3. Ejecutar los comandos existentes: backend lint/typecheck/test/build; web lint/test/build; mobile test/TypeScript; `node scripts/check-project-consistency.cjs`. Documentar lo omitido y su causa.
4. Cada PR incrementa SemVer sobre el BASE ACTUAL y sincroniza `package.json` y `package-lock.json` de backend/web/mobile, `mobile/app.json`, `README.md` (versión candidata), `docs/BETA_ACEPTACION.json` y `docs/UAT_MATRIZ_2026-10-15.json`.
5. CI aprobado refiere un SHA exacto, no prueba IIS, proveedores de correo, restores, teléfonos o UAT de representantes institucionales.
6. Crear rama y PR revisable; no fusionar ni desplegar por inferencia, ni ejecutar `scripts/windows/Deploy-Staging.ps1` fuera de solicitud operativa explícita. Rollback de aplicación no revierte DDL.
7. Priorizar riesgos por severidad y pruebas que bloquean aprobación; no afirmar éxito sin salida de comandos o checks.

## Entrega
Resumen de alcance, archivos, versionado, pruebas y CI por SHA, migraciones, seguridad, pendientes de UAT y recomendación merge/no merge con causas.
