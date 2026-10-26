# Barrido del proyecto · 26 de octubre de 2026

Base examinada: `main` 1.27.51, merge `2227427` del PR #200; correcciones y calendario en la candidata 1.27.52. El SHA definitivo y los resultados de integración se consultan en el PR de esta entrega. Revisión transversal de API NestJS, React, Expo alumno, SQL espejo/manifiesto, ETL, scripts Windows, CI y documentación. Se combinaron inspección estática, contratos y suites existentes; no se afirma ausencia absoluta de defectos ni certificación de producción.

## Hallazgos y acciones

| Prioridad | Ubicación y hallazgo comprobado | Acción / evidencia |
|---|---|---|
| Alta, corregida | Integración conjunta: `web/package.json`/lock habían perdido `axe-core`; fallaba el job axe | Restaurada dependencia 4.14.0 en `d8187e0`; CI #200 aprobado antes de integrar |
| Media, corregida | `mobile/app.json`: la resolución conjunta de JSON había perdido configuración de Face ID | Restaurados plugins Expo de #197 en `d8187e0`; CI móvil #200 aprobado |
| Alta funcional, corregida | `calendario.service.ts`, `consulta`: no existía separación de nivel ni audiencia interna | Filtros backend por inscripción/asignación, nivel y audiencia; pruebas de nivel cruzado y cortes ocultos |
| Media funcional, corregida | Rutas y permisos de calendario: FINANZAS no tenía el alcance solicitado | Guard, política, web y rol mixto docente/finanzas armonizados; personal siempre conserva ScopeService por plantel |
| Media funcional, corregida | Calendario carecía de imágenes y vistas mes/ciclo | API, almacenamiento privado y clientes web/Expo; firma, sesión y autorización en descarga |
| Baja, corregida | README contenía entradas e historial duplicados tras integración; estado principal anclado en 1.27.40 | Resumen consolidado y `ESTADO_IMPLEMENTACION.md` actualizado, sin reescribir evidencias históricas |
| Media, pendiente operativa | Calendarios anteriores y grupos pueden carecer de nivel | Compatibilidad conserva eventos generales; institución debe clasificar los exclusivos y completar grupos antes de publicación |
| Media, deuda técnica | ESLint reporta centenares de advertencias backend y ocho web, principalmente tipos `any` y dependencias de hooks | No bloquean compilación; conviene resolver por módulo con pruebas de autorización, sin sustituciones masivas de tipos |
| Media, alcance incompleto declarado | ETL es parcial y no sustituye conciliación histórica; proveedores y operación tienen puertas pendientes | Mantener bloqueo institucional hasta validar datos sanitizados, correo, antivirus, restauración e IIS |

No se encontraron marcadores literales TODO/FIXME/HACK/NotImplemented en `backend/src`, `web/src` ni `mobile/src`; esto no demuestra completitud funcional. No se encontró reactivación de `useStaticAssets` en fuentes de aplicación. Archivos de uploads versionados: solo `.gitkeep`; no se publican datos reales en esta auditoría.

## Comprobaciones y límites

- Backend: lint, typecheck, build y 87 suites / 477 pruebas unitarias aprobadas localmente. La integración de BD se valida en CI con bases descartables MySQL y SQL Server.
- Web: lint, build y 58 archivos / 220 pruebas aprobadas localmente; ocho advertencias de lint preexistentes. Se mantiene CI responsive/E2E, axe y Lighthouse.
- Expo: TypeScript, 22 archivos / 120 pruebas Vitest y 11 controles Node aprobados localmente. No equivalen a instalación física.
- `npm audit --omit=dev --json`: cero vulnerabilidades conocidas reportadas para dependencias de producción de backend, web y mobile en este corte. No cubre código propio, dependencias de desarrollo ni vulnerabilidades futuras.
- Controles del repositorio: consistencia de versiones/rutas, skills, matriz UAT y puertas beta; el PR registra los resultados actuales por SHA. ETL y scripts Windows conservan sus jobs en CI.
- CI #200 validó backend, web, móvil, ETL, Windows, MySQL, SQL Server, E2E, axe, Lighthouse y estructura de auditoría. El job responsive de auditoría separado se omitió por condiciones del workflow; el job web-e2e sí ejecutó su recorrido responsive.

No se ejecutaron correos, cobros ni operaciones sobre datos institucionales, despliegues o migraciones de servidores compartidos. Pendientes: UAT firmado por rol/nivel/plantel, accesibilidad manual, dispositivos Android/iOS, respaldo/restauración, ACL de uploads y recepción de correo. Estos límites son de evidencia y operación; no se presentan como fallos reproducidos del código.

La ampliación del calendario se describe en [el contrato 1.27.52](CALENDARIO_CICLO_NIVEL_1.27.52.md). No se alteró la escala vigente ni se habilitaron políticas institucionales pendientes.
