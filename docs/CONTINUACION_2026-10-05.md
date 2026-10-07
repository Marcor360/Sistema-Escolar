# Continuación de la auditoría — 5 de octubre de 2026

Este documento actualiza `AUDITORIA_ACTUAL_2026-10-05.md` con los cambios posteriores a la revisión del cierre de sesión. El análisis encontró tres riesgos locales de integridad que se podían corregir sin acceso al servidor institucional.

## Implementado

1. **Cargos y bitácora financiera en una sola transacción.** La creación de cargos, cada colegiatura generada y la aplicación de recargos ahora confirman el cambio y su registro de auditoría juntos. Si falla la bitácora, se revierte la operación. Los recargos bloquean y vuelven a validar cada cargo antes de modificarlo. La generación omite grupos inactivos y alumnos dados de baja.
2. **Inscripciones frente a bajas de grupo.** La inscripción y la baja lógica bloquean el mismo grupo en transacciones. La inscripción rechaza grupos inactivos y alumnos cuyo estatus no sea `ACTIVO`; la asignación de materia rechaza grupos inactivos.
3. **Reintentos de pago manual.** `POST /finanzas/pagos` exige `claveIdempotencia` UUID v4. El mismo actor puede reenviar el mismo pago con la misma clave y recibe el registro original; una clave reutilizada con datos distintos responde 409. La clave tiene índice único en ambos motores, con migraciones incrementales y paridad en entidades y esquemas documentales. El portal conserva la clave mientras se reintenta el mismo formulario después de un fallo.
4. **Validación de importes y fechas.** Un cargo manual exige monto positivo, descuento no mayor que el monto, hasta dos decimales, periodo válido y fecha de vencimiento válida.

## Verificación local

- Backend: `npm run lint`, `npm run typecheck`, `npm test -- --runInBand` (22 suites, 121 pruebas) y `npm run build`: pasan.
- Web: `npm run lint`, `npm test` (5 pruebas) y `npm run build`: pasan.
- Móvil: `npx tsc --noEmit` y `npm test` (2 pruebas): pasan; no hubo cambios móviles en esta continuación.
- Se añadieron casos de integración HTTP para reintentos de pago, rollback de cargo/recargo cuando falla la bitácora, grupo inactivo y alumno inactivo. Estos casos compilan, pero requieren ejecutar la suite con bases MySQL y SQL Server aisladas. No se aplicó ninguna migración a una base existente.

## Pendiente para el piloto

- Ejecutar la integración HTTP y las migraciones nuevas en ambos motores, usando bases desechables o copias aisladas; después ensayar la actualización de una copia institucional antes del despliegue.
- Certificar restauración real de MySQL y `uploads`, Openpay sandbox, correo SMTP, IIS/TLS y operación en el VPS elegido. Estas pruebas necesitan infraestructura y credenciales institucionales.
- Acordar con la institución la regla de cierre y corrección de periodos de calificaciones antes de implementar el bloqueo e historial de cambios; validar formatos de reportes y volumen con datos anonimizados.
- Ampliar la aceptación por roles, planteles, navegadores y dispositivos, y mantener el seguimiento de dependencias descrito en la auditoría inicial.

La nueva migración `migracion_pagos_manual_idempotencia.sql` debe quedar aplicada antes de publicar la API y el portal de esta continuación.

## Segunda revisión

El portal web ahora valida el token guardado con `GET /auth/me` al arrancar y toma los roles vigentes del servidor. Una sesión revocada elimina el token local; si la comprobación falla por red, muestra un aviso con opción de reintentar sin usar roles antiguos. Se añadieron pruebas de cambio de rol, revocación y fallo de red. Web pasa lint, 8 pruebas y build.

La app móvil conserva el token si `GET /auth/me` falla por conexión y presenta un botón para reintentar la comprobación. Una respuesta 401 mantiene el comportamiento de eliminar la sesión. TypeScript y las 2 pruebas móviles existentes pasan. Queda pendiente recorrer este comportamiento en un dispositivo con pérdida y recuperación de red.

## Tercera revisión

Las entregas del alumno rechazan actividades desactivadas. Si se reentrega una actividad ya calificada, se limpia la calificación y el comentario del docente para que la nueva versión quede pendiente de revisión; la fecha y el estado de entrega se actualizan. La entrega, la calificación y la desactivación usan bloqueos de fila para evitar que dos operaciones simultáneas dejen un estado contradictorio. Una carga de material sin archivo responde 400. Cuando un archivo ya fue guardado por Multer y falla el servicio, se intenta retirar ese archivo nuevo del directorio configurado.

Se añadieron pruebas unitarias y un caso HTTP de entregar, calificar, reentregar y desactivar. La suite HTTP sigue pendiente de una ejecución en bases MySQL y SQL Server aisladas. También queda pendiente revisar en un dispositivo la reentrega con archivo y definir con la institución si se permite reentregar después de calificar o si requiere autorización docente.

## Seguimiento — 6 de octubre de 2026

La CI del commit `b5612c0` ([ejecución 37407826286](https://github.com/Marcor360/Sistema-Escolar/actions/runs/37407826286)) terminó correctamente en backend, web, móvil, ETL, scripts Windows e integración HTTP con MySQL y SQL Server aislados. Esto cierra el pendiente de ejecutar las pruebas de integración y las migraciones nuevas en ambos motores sobre bases desechables; no certifica la actualización de una copia institucional ni la aplicación de migraciones en producción.

El mismo commit añadió el cierre y reapertura de periodos de calificación por personal autorizado, bloqueo de captura en periodos cerrados e historial de cambios de nota. La regla institucional de quién puede reabrir y bajo qué motivo aún debe validarse con la institución antes del piloto. La migración `migracion_cierre_historial_calificaciones.sql`, junto con `migracion_pagos_manual_idempotencia.sql`, debe aplicarse mediante el runner incremental antes de publicar estas funciones.

En móvil, reemplazar una entrega calificada ahora solicita confirmación y avisa que se retirarán temporalmente la nota y el comentario; se bloquean envíos simultáneos desde la pantalla. Siguen pendientes las pruebas en dispositivo de reentrega con archivo y de pérdida/recuperación de red, además de la decisión institucional sobre reentregas posteriores a la calificación.

Para el piloto siguen pendientes el ensayo de migraciones sobre una copia institucional aislada, la restauración real de MySQL y `uploads`, Openpay sandbox, SMTP, IIS/TLS/VPS, formatos y volumen de reportes con datos anonimizados, y aceptación por roles, planteles, navegadores y dispositivos. Requieren el entorno, las credenciales o las decisiones de la institución.

## Endurecimiento local — 6 de octubre de 2026

Se activó `noImplicitAny` en el backend y se corrigieron sus errores; `strict: true` completo todavía produce 344 diagnósticos, principalmente en DTO, entidades y pruebas, y requiere una migración gradual. ESLint ahora rechaza `any` explícito en código de producción; los archivos `*.spec.ts` lo señalan como advertencia mientras se tipan sus dobles de prueba. Los 495 avisos de lint son deuda de las pruebas, no errores del código de producción.

Los paquetes y la versión de la app se alinearon a `1.13.0`; Swagger toma la versión del paquete. El arranque de Nest usa `Logger`. El portal IIS añade CSP, Permissions Policy, protección contra iframes y HSTS; antes de publicar hay que comprobar la política con los dominios definitivos de API y archivos. La app móvil se migró a Expo SDK 57 y a la configuración vigente del splash. El modelo access + refresh, sesiones por dispositivo y almacenamiento web con cookie `HttpOnly` siguen pendientes como un cambio conjunto de API, clientes y migraciones incrementales en ambos motores.

## Barrido de errores de archivos — 6 de octubre de 2026

Todos los `.ts` y `.tsx` propios están cubiertos por los proyectos TypeScript de backend, integración HTTP, web y móvil. Se añadieron importaciones explícitas de Jest en la suite HTTP, un `tsconfig` para esa suite dentro del typecheck de backend y `vite.config.ts` al typecheck web. El barrido posterior pasó: backend lint sin errores, typecheck, 124 pruebas y build; web lint, 8 pruebas y build; móvil TypeScript, 4 pruebas, `expo-doctor` 21/21 y exportaciones Android/iOS; ETL 3 pruebas y sintaxis de 7 archivos Python; sintaxis y pruebas locales de 9 scripts PowerShell; sintaxis de 8 archivos JS/CJS; 15 JSON, YAML de CI, Compose y XML del portal válidos; 8 ejemplos de entorno con asignaciones bien formadas; 79 enlaces Markdown locales existentes. Los 36 archivos SQL tienen nombres espejo y el manifiesto referencia archivos presentes. Backend y web reportaron cero vulnerabilidades en `npm audit`; móvil conserva las dos excepciones altas documentadas.

No se ejecutó la integración SQL de la versión local porque el motor Docker no está activo. La comprobación de nombres y manifiesto no sustituye ejecutar las migraciones en bases aisladas. Tampoco equivale a una prueba EAS nativa ni a aceptación en dispositivos físicos.

## Actualización de documentación y TypeScript — 6 de octubre de 2026

El README y `ESTADO_IMPLEMENTACION.md` reflejan ahora la versión `1.13.0`, Expo SDK 57, el alcance real del ETL, las pruebas locales y la ruta de piloto. En backend se activó `strictNullChecks` y después `strict: true`, manteniendo `strictPropertyInitialization: false` como excepción explícita para propiedades de DTO y entidades hidratadas por decoradores. Con esa excepción, el typecheck de `src/` y `test/` pasa. Activar también `strictPropertyInitialization` produce 342 diagnósticos `TS2564`, que deben abordarse por módulos con declaraciones definidas de forma segura.
