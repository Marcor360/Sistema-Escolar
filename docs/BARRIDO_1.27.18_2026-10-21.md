# Barrido de código e información — candidata 1.27.18

Corte: 21 de octubre de 2026. PR [#163](https://github.com/Marcor360/Sistema-Escolar/pull/163), base `main` 1.27.17 (`8579ab4bf99eb4eba27e44e450dd92705b1c398c`). Código revisado inicialmente: `1655aa7b7ce9efd21e6dca9702ad09d40a0fe118`. Esta revisión agrega correcciones de información y del mensaje de tamaño del portal a la misma candidata. Confirmar el SHA final y su CI antes de integrar.

## Resultado del barrido

| Área | Resultado y acción |
|---|---|
| PR y base | Sin conflictos en la base inspeccionada. Se conserva 1.27.18, superior a main 1.27.17; no se crea otra entrega/versionado dentro del mismo PR. |
| Versiones | Backend, web, mobile, lockfiles, Expo y matrices de aceptación alineados en 1.27.18. |
| Logo | Entrada web ≤20 MiB; salida/API WebP ≤10 MiB; publicación con UUID después de validar firma y lectura. El mensaje genérico de rechazo API ahora distingue el límite de salida de 10 MiB. |
| Identidad | Metadatos públicos persistidos y revalidados por web/Expo; sincronización de pestañas y recuperación tras fallo de red. No garantiza disponibilidad offline del archivo de imagen. |
| Documentación vigente | Actualizados README principal, índice documental, estado de implementación, política de versiones, API, arquitectura, operación, migraciones, etapas del contrato y guía IIS. Se corrigen cinco pestañas móviles y el orden de 19 incrementales contra código/manifiesto. Las auditorías fechadas conservan sus resultados originales. |
| Esquema | Sin cambios SQL en #163. El manifiesto actual contiene baseline v1 y 19 incrementales por motor; no equivalen a migraciones aplicadas en el servidor. |
| Seguridad de archivos | Logos públicos por controlador del módulo archivos; documentos privados con firma y autorización. No se habilitan estáticos ni se publica el directorio uploads en IIS. |
| Operación | Límite IIS de al menos 11 MiB para multipart de logo, almacenamiento persistente y ACL por comprobar en host. No se recrean sitios, bases ni servicios. |

## Evidencia verificable

La [CI 39637464149](https://github.com/Marcor360/Sistema-Escolar/actions/runs/39637464149) aprobó los ocho jobs para `1655aa7b7ce9efd21e6dca9702ad09d40a0fe118`: backend, web, mobile, integration-mysql, integration-sqlserver, etl, windows-scripts y web-e2e. Incluye lint/tipos/builds, pruebas, auditorías npm, integración de ambos motores, export Android, validación PowerShell y recorridos Chromium. Esta ejecución no se atribuye a commits posteriores.

Validación local de esta revisión: backend lint (sin errores, advertencias existentes), typecheck y 365 pruebas en 68 suites; web lint (sin errores, advertencias existentes), 200 pruebas en 50 archivos y build con URL HTTPS de ejemplo; móvil instalación por lockfile, TypeScript y suite npm aprobados. Consistencia de versiones/rutas, incremento 1.27.17 → 1.27.18, puertas beta y matriz UAT estructural aprobados. Las ocho puertas y los trece escenarios institucionales siguen pendientes.

Las validaciones de esta revisión se registran en la descripción del PR y en la CI del SHA final. La aceptación institucional sigue en [BETA_ACEPTACION.json](BETA_ACEPTACION.json) y [matriz UAT](UAT_MATRIZ_2026-10-15.json); no se aprueban puertas por revisar documentación o por compilar.

## Pendientes y límites

- IIS/ACL: POST real y GET público 200 `image/webp`, almacenamiento tras reinicio/redeploy y rechazo de archivos privados. La incidencia #106 continúa abierta sin evidencia del host; [procedimiento](LOGO_WEBP_STAGING_1.27.18.md).
- Marca: probar roles/sesiones/pestañas, pérdida y recuperación de red y Android/iOS físicos. Recompilar/actualizar la app instalada para incorporar la lógica; icono/splash nativos requieren rebuild.
- Operación institucional: SMTP, antivirus, restore, pagos y UAT por rol/plantel mantienen sus puertas y responsables; la CI no los certifica.
- README informa staging 1.27.17 (`8579ab4`) como confirmación del operador previa a esta revisión. No se obtuvo nueva evidencia del servidor ni se realizó despliegue en este barrido.
- La política versionada de main exige una aprobación independiente y checks del último SHA. La lectura de la protección efectiva por API devolvió HTTP 403; no se puede afirmar que esa configuración esté aplicada. No se altera ni se elude la protección.

Integrar código en main y desplegarlo son acciones distintas. Este barrido no certifica aceptación institucional ni cierre de #106.
