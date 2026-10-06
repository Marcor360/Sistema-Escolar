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
