# Outbox duradero de invitaciones y recuperación (#121)

## Comportamiento implementado
Los endpoints conservan sus mensajes genéricos y sus límites de cinco solicitudes/minuto. Esperan el commit de la solicitud en `auth_correo_outbox`, sin esperar SMTP ni guardar destinatario, HTML o código en esa tabla. Cuenta inexistente, deshabilitada o incompatible con el flujo no genera trabajo. Un error de base no devuelve un falso acuse de persistencia.

La exclusión por usuario y READ COMMITTED coalescen solicitudes del mismo tipo/versión durante una hora, incluso tras aceptación SMTP o agotamiento de reintentos. No se pierde la solicitud número 101 por un límite en memoria. El worker procesa diez trabajos por ciclo de cinco segundos y un envío simultáneo por instancia. Otras instancias reservan mediante UPDATE condicional, claim UUID y lease de 120 segundos con renovación cada 30; un proceso caído deja un lease recuperable. El transporte tiene socketTimeout de 30 segundos. Los relojes de los servidores deben estar sincronizados.

## Protocolo del código
1. Una transacción corta bloquea usuario y trabajo; comprueba actividad, activación pendiente y versión de sesión.
2. Deriva el código con HMAC-SHA256 y clave aleatoria externa versionada; incluye dominio de propósito, UUID de trabajo, tipo, usuario y versión. Activación conserva 64 hex; recuperación conserva 32 hex (128 bits).
3. Revoca los códigos anteriores del mismo flujo y confirma el nuevo hash, su caducidad y el identificador de clave en la misma transacción. Solo entonces envía SMTP, fuera de toda transacción.
4. Los reintentos y reinicios reconstruyen exactamente el mismo código. No renuevan su caducidad ni revocan el primer código por repetir una solicitud. Un cambio de contraseña/activación sigue revocando sesiones y tokens conforme a los contratos existentes.
5. Si el proceso cae después de aceptación SMTP pero antes de registrar el resultado, puede repetirse el mensaje con el mismo código y Message-ID. El protocolo es **al menos una vez**; SMTP no ofrece commit distribuido ni entrega exactamente una vez. No se promete recepción en Inbox. Una pausa superior al lease puede producir una reentrega; el claim evita que un worker antiguo confirme el trabajo reservado por otro.

## Configuración y rotación (previas al despliegue)
Aplicar la migración incremental `migracion_auth_correo_outbox.sql` para el motor correspondiente mediante el runner habitual, con respaldo y `DB_SYNC=false`. No ejecutar schema.sql sobre una base existente.

`AUTH_OUTBOX_KEYS` es un objeto JSON privado de identificadores y claves de 32 bytes aleatorios en hexadecimal. `AUTH_OUTBOX_ACTIVE_KEY` selecciona la clave de nuevos tokens. Usar un gestor de secretos; no reutilizar JWT_SECRET ni copiar las claves sintéticas de tests. Con SMTP_HOST configurado, el arranque falla si estas variables faltan o son inválidas. Sin SMTP se pueden persistir solicitudes; sin clave no se emite código y el trabajo reintenta hasta su límite/TTL.

Para rotar: distribuir primero el anillo con clave antigua y nueva en todas las instancias; luego cambiar la activa. Conservar la antigua hasta que no haya trabajos sin expirar asociados. No editar clave_id ni token_hash de trabajos existentes. Perder una clave impide reconstruir sus códigos; registrar el incidente, conservar la vigencia original y solicitar una nueva ventana tras su expiración. Nunca volver a marcar como no usado un token consumido.

## Estados, límites y observación
PENDIENTE → PROCESANDO → ACEPTADO, o PENDIENTE con backoff de 15/30/60/120/240 segundos (tope 300). Máximo seis intentos; después FALLIDO. TTL fijo de una hora desde la solicitud; EXPIRADO no se envía. Cambios de versión/estado o token revocado cancelan el trabajo. La lectura operativa se limita a id, tipo, estado, intentos, proximo_intento, lease_hasta, expira_en y error_codigo, con acceso DB administrativo existente; no hay endpoint público para enumerar solicitudes. Los logs contienen UUID, estado y contador, sin direcciones, códigos ni excepciones SMTP crudas.

La retención de metadatos es configurable con `AUTH_OUTBOX_RETENTION_DAYS` (30 días por defecto, rango 1–365), contados después de expirar. El worker elimina solo sus filas vencidas tras ese periodo; no borra usuarios, tokens ni sesiones. Ajustar este valor a la política institucional antes del despliegue. `AUTH_OUTBOX_WORKER=false` detiene el consumo local para mantenimiento/pruebas, conservando solicitudes. El aviso al responsable de plantel sigue sin códigos y se intenta tras aceptar el correo de recuperación; es auxiliar, no condiciona la validez del token.

## Verificación
Pruebas de contrato, persistencia antes de responder, claves/rotación y reconstrucción. Integración MySQL/SQL Server: 110 solicitudes concurrentes, lotes acotados, dos workers, reinicio antes/después de SMTP, leases, backoff, seis fallos, TTL/retención, cancelación por estado/versión, hash/código coherentes, uso único y locks liberados mientras SMTP está detenido. Mantener #107 abierto hasta comprobar entrega institucional real. Este PR no despliega ni configura secretos de staging/producción.
