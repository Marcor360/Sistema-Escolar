# Protección de la rama principal — propuesta de configuración

## Diagnóstico
La consulta `GET /repos/Marcor360/Sistema-Escolar/branches/main` informó `protected=false` (17/10/2026). La CI de `.github/workflows/ci.yml` sí define ocho trabajos, pero un workflow no equivale a una regla de protección.

## Aplicación en GitHub (administración, fuera del commit)
1. Configurar **Settings → Rules → Rulesets** para `main` con aplicación obligatoria.
2. Exigir Pull Request aprobado por una persona distinta de quien realiza los cambios; impedir aprobación de cambios propios y descartar aprobaciones obsoletas después de nuevos commits.
3. Exigir todas las comprobaciones con nombres reales y estables: `backend`, `web`, `mobile`, `integration-mysql`, `integration-sqlserver`, `etl`, `windows-scripts` y `web-e2e`. Comprobar el origen GitHub Actions de cada una antes de configurar los contextos; si cambian, actualizar reglas.
4. Exigir que las conversaciones de revisión estén resueltas, impedir actualización forzada, borrado de `main` y bypass general. Hacer una excepción solo documentada para recuperación operativa.
5. Verificar que el propio administrador quede sujeto a las reglas y que exista un segundo revisor independiente; si el plan de GitHub no permite el conjunto, documentar el límite y compensar con controles operativos.
6. Ensayar un PR con comprobación fallida y un intento de push directo; documentar el rechazo **sin** publicar secretos ni modificar datos.

## Aceptación
- `main.protected=true` o ruleset activo y obligatorio comprobado mediante configuración administrativa.
- Un PR con prueba fallida o sin revisión independiente no puede fusionarse.
- `deploy-staging.yml` mantiene su validación de SHA y CI de `main`.

## Estado
**Pendiente de acción administrativa.** Este documento dentro de un PR **NO activa** la protección y no debe marcarse como corrección completa al fusionarlo.
