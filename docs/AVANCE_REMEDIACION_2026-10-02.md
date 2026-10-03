# Avance de remediación — 2 de octubre de 2026

## Fase 0 — estabilización de CI

La ejecución GitHub Actions `1.8.2` (2 de octubre, run `37038935551`) confirmó que Backend, Mobile y ETL pasan; Web falló al iniciar workers `fork` de Vitest y las integraciones MySQL/SQL Server completaron el arranque y baseline, pero excedieron el límite estricto de cinco logins por IP durante la suite.

Correcciones aplicadas en este árbol de trabajo:

- Web ejecuta Vitest con un worker para evitar fallos de creación de procesos en el runner Linux.
- Las pruebas de integración generan JWT de fixture para los flujos protegidos y conservan una llamada real a `/auth/login`; no se cambia el límite de autenticación de cinco intentos.
- Ambos jobs de base ya mantienen `DB_SYNC=false` y el baseline instalable en una base aislada. MySQL cuenta con health check de servicio; SQL Server cuenta con health check y reintentos con timeout para crear la base cuando el servidor queda listo.

Verificación local de este corte: backend lint, typecheck, build y 106 pruebas; web lint, 5 pruebas y build; mobile 2 pruebas, TypeScript y export Android; ETL 3 pruebas. El test de integración también compila sin errores. Esta máquina no tiene Docker ni puertos de base disponibles, por lo que los dos motores aún requieren una ejecución CI posterior a estos cambios. La Fase 0 permanece **PARCIAL** hasta que MySQL y SQL Server terminen verdes en Actions.

Después de la ejecución remota, la base de avisos npm incorporó `GHSA-vfj7-8cjw-p6xm` para `braces` hasta 3.0.3 y actualmente no declara una versión corregida. La auditoría local reporta altas solo en dependencias de desarrollo de backend/web; `npm audit --omit=dev` informa cero en ambos. El job remoto `1.8.2` aún había reportado cero al ejecutarse. Se conserva el chequeo completo y se documenta este hallazgo para resolverlo al existir actualización compatible; no se baja el umbral de auditoría.

Este corte complementa `AUDITORIA.md`, cuya revisión inicial fue el 1 de octubre. Los cambios están en el árbol de trabajo y aún no se han desplegado ni validado con las cuentas o servicios institucionales.

## Riesgos corregidos en código

- Los pagos manuales bloquean el cargo, calculan el saldo dentro de la transacción y rechazan excedentes. Un pago capturado por Openpay que ya no se puede aplicar queda registrado como pago no aplicado y en bitácora para revisión de Finanzas.
- Una orden Openpay creada o pendiente reserva el cargo frente a pagos manuales. El procesamiento concurrente del webhook vuelve a bloquear cargo y orden, valida importe y es idempotente.
- Producción exige API Openpay productiva, retorno HTTPS, credenciales de comercio y usuario/contraseña del webhook. Producción exige configuración SMTP; fallos de entrega de recuperación quedan registrados sin cambiar la respuesta pública genérica.
- El seed ya no tiene contraseñas de cuentas demo en código. Exige cinco secretos diferentes de al menos 16 caracteres y fija `synchronize: false`.
- Se añadieron pruebas unitarias de excedentes, pagos parciales exactos, pagos Openpay no aplicados, configuración de producción, contraseñas seed y error SMTP. La integración conserva escenarios de pagos parciales, reserva de órdenes, webhooks concurrentes y descarga firmada.
- Los estados móviles distinguen carga inicial, error y lista vacía; los textos de aviso usan un tono oscuro y los controles móviles principales tienen áreas táctiles de 44 dp. El login web ya usa ancho fluido para viewports estrechos.
- CI revisa dependencias, espera disponibilidad de SQL Server, ejecuta pruebas web/móvil y exporta el bundle Android de Expo.

## Dependencias

La auditoría npm local del 2 de octubre informa cero vulnerabilidades en backend y web. El móvil conserva una alerta alta transitiva GHSA-86w9-cpqp-85rv en `node-forge`, dentro de Expo 56; se documentó una excepción específica que hace fallar CI si aparece otra alerta alta/crítica o si la excepción ya no coincide. No se bajó Expo a una versión mayor incompatible.

## Verificación local

- Backend: lint, typecheck, build y Jest — 22 suites; 106 pruebas tras agregar los casos de remediación.
- Web: lint, 2 archivos de prueba / 5 pruebas, build y `npm audit` sin hallazgos.
- Móvil: revisión de auditoría conforme a la excepción, TypeScript y export Android completados.
- ETL: 3 pruebas de adaptadores completadas.

La integración HTTP contra MySQL y SQL Server sigue pendiente: esta máquina no tiene Docker ni servicios de base de datos. Los jobs están configurados en CI; deben quedar verdes en ambos motores.

## Pendientes bloqueados por datos o responsables externos

- El ETL de usuarios, docentes y grupos requiere el esquema real de `certweb`; no se inventaron tablas o columnas. Faltan esquema sanitizado/acceso de solo lectura y reglas de identidad para consolidar usuarios.
- El despliegue requiere decidir hosting, dominios, TLS, almacenamiento y respaldos; faltan las credenciales del cliente de SMTP y Openpay, formatos oficiales de reportes y textos legales aprobados.
- La prueba de pasarela exige credenciales sandbox y conciliación aprobadas. La aceptación en dispositivos/navegadores, con lector de pantalla y personal escolar, requiere dispositivos y usuarios acordados.

## Pendientes técnicos del repositorio

- No existe todavía un runner ni un registro automático de migraciones. Antes de implementarlo hay que acordar y probar el mecanismo en MySQL y SQL Server aislados.
- La unicidad de grupos por ciclo/nombre no permite repetir el nombre en otro plantel. La corrección histórica exige retirar el índice vigente, acción no permitida por las instrucciones actuales; no se cambió el esquema.
- La suite automatizada del portal cubre autorización de rutas y pruebas de mensajes de error, pero necesita más flujos de usuario. El móvil tiene pruebas de utilidades y bundle JavaScript, no compilación nativa firmada ni pruebas de interacción en dispositivo.

No se declara el MVP listo para producción con este corte.
