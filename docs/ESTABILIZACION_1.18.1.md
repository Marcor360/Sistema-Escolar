# Estabilización operativa — 1.18.1

8 de octubre de 2026. Base: 7142139c1666e2e4bb9a4ae4aacebf253dd167da (1.18.0). Esta entrega cierra las correcciones y pruebas de código de los cuatro recorridos solicitados; no certifica todavía el piloto institucional.

## Calificaciones

Una captura cuyo valor y observaciones efectivos coinciden con la nota almacenada devuelve `capturadas: 0, sinCambios: 1`. No escribe nota ni historial ni cambia autor/fecha. Omitir observaciones conserva las existentes; retirarlas con cadena vacía es una corrección real y exige motivo. No se purga el historial de auditoría previamente almacenado. Las lecturas bloqueadas se hacen por lote, las notas e instantáneas se escriben dentro de la transacción y el historial se inserta en lotes compatibles con SQL Server.

El selector de clases busca y pagina en el servidor, muestra plantel/ciclo/grupo/materia y aplica permisos académicos. MAESTRO sigue limitado a sus clases incluso con FINANZAS; Finanzas solo y alumnos no pueden usarlo. La pantalla marca notas inválidas y mueve el foco, exige motivo al corregir, preserva datos/motivo ante fallos y envía solo cambios. Valores vacíos no eliminan notas existentes. Un fallo de actualización del resumen después de guardar informa que la captura sí fue confirmada. Cierre consulta faltantes y exige guardar cambios antes; notas quedan deshabilitadas en periodo cerrado.

## Usuarios y expedientes

Alumnos: teléfono, fecha de nacimiento y dirección, además de apellidos, CURP y tutor. Docentes: apellido materno, teléfono y cédula profesional. Personal: apellido materno y teléfono, roles y planteles explícitos. Los PATCH permiten limpiar teléfono/apellido materno aun cuando no se modifica otro campo; la fecha acepta null para retirarla y solo fecha YYYY-MM-DD para capturarla.

Etiquetas asociadas, controles de contraseña enmascarados, estados accesibles de carga/envío/error/éxito y bloqueo de doble envío. Listados de usuarios/docentes descartan respuestas obsoletas. Se recorren altas ALUMNO desde expediente, MAESTRO desde docente y ADMINISTRATIVO/FINANZAS/SUPERADMIN desde personal, con cambio obligatorio de contraseña temporal y revocación de la sesión inicial. No se crea ALUMNO/MAESTRO desde alta genérica.

## Grupos y ciclo

Prueba integrada: preparar y activar ciclo, configurar docente/materia/grupos en dos planteles, inscribir, bloquear cambio directo de plantel, transferir con baja de inscripción anterior, reinscribir y rechazar duplicado; capturar P1/P2/P3, cerrar parciales, consultar promedio oficial 90, generar PDF/Excel, cerrar ciclo y rechazar captura tardía. Previsualizar y confirmar promoción al ciclo siguiente, rechazar repetición y conservar calificaciones anteriores; el móvil distingue vigente de histórico explícito.

El aislamiento de ciclo global se hace únicamente en una base nueva de integración con fixtures sintéticos; no es un procedimiento operativo para cerrar ciclos institucionales. El navegador comprueba también baja/reinscripción, captura idéntica, corrección con motivo, cierre/reapertura y descargas.

## Finanzas

Se corrigió el orden del listado paginado de conciliación: propiedad TypeORM `fechaPago` con desempate por ID. La paginación con joins requería esa referencia y fallaba usando el nombre físico de columna.

Escenario API/base real: cargo 200 con descuento 20; pago parcial 50 y reintento idempotente; rechazo de cancelación con pago aplicado; anulación devuelve saldo 180; cancelación devuelve saldo cero. Otro cargo 120 recibe conciliación de pago confirmado 50 y queda saldo 70; repetir aplicación se rechaza. El Excel de adeudos refleja exactamente ese saldo y se verifican auditorías de actor/cancelación/anulación/conciliación. La confirmación de pasarela usa un fixture sintético: no constituye certificación de Openpay.

## Verificación y operación

Backend: 167 pruebas en 33 suites; web: 17 en ocho archivos; móvil: ocho pruebas más cinco del gate de auditoría, TypeScript y export Android; ETL: tres pruebas. npm ci/audits de los tres componentes, lint/typecheck/build aplicables sin errores; audits sin vulnerabilidades. MySQL 8.4: 61 casos, incluidos tres recorridos Chromium sin interceptar API; SQL Server 2022: 58 casos verdes. Nueve scripts PowerShell pasan análisis sintáctico en Linux; la prueba funcional de junctions corresponde al job Windows de la CI final. Se mantienen TypeScript estricto, reglas productivas de lint, pruebas y DB_SYNC=false. Carga sintética: 100 alumnos, tres clases, 900 notas y tres capturas simultáneas. P95 de captura: MySQL 356 ms; SQL Server 1340 ms; analítica 16/105 ms y resumen de cierre 16/35 ms respectivamente. Es una medición local reproducible, no un SLA de staging.

No hay cambios de entidades, baseline, schemas ni migraciones nuevas; aplicar las migraciones ya pendientes de versiones anteriores mediante el runner.

Rollback: regresar al código 1.18.0 sin revertir esquema. No elimina notas, pagos ni auditoría. El historial previo permanece íntegro. Inventario completo: [ARCHIVOS_ESTABILIZACION_1.18.1.md](ARCHIVOS_ESTABILIZACION_1.18.1.md).

Pendientes externos: staging Windows/IIS/HTTPS, SMTP real, Openpay sandbox, push FCM/APNs, móviles físicos firmados, contraste/lector de pantalla/dispositivos y backup restaurado. Certweb histórico requiere esquema real sanitizado. Chromium automatizado no reemplaza pruebas físicas ni accesibilidad completa. No declarar PILOTO LISTO hasta certificar el gate institucional.
