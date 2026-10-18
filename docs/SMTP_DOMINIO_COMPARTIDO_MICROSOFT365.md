# Entrega de correo IUA entre cPanel y Microsoft 365

## Incidencia confirmada por el operador

El buzón emisor `plataforma-stagin@iua.edu.mx` envía códigos/invitaciones con Nodemailer a través de `mail.iua.edu.mx:465`. Algunos destinatarios `@iua.edu.mx` alojados en cPanel sí reciben mensajes y otros destinatarios del **mismo dominio**, alojados en Exchange Online (Microsoft 365), no los reciben. Todavía no está identificada la etapa de pérdida o filtrado.

**No cambiar MX, SPF, DKIM, DMARC, Email Routing ni conectores** sin obtener trazas y un plan de continuidad del correo; un cambio global a *Remote Mail Exchanger* puede romper los buzones que funcionan en cPanel.

## Árbol de diagnóstico de solo lectura

1. Anotar **sin guardar el código/token** la hora UTC, remitente, destinatario de prueba y asunto de una invitación. Hacer una prueba a un buzón cPanel del dominio y a uno Exchange Online del mismo dominio, sin enviar masivamente.
2. cPanel → **Email → Track Delivery**: buscar al destinatario Outlook, observar si quedó **Local**, **Remote**, **Defer** o **Reject** y guardar solo el código SMTP/host de entrega. En **Email → Email Routing**, observar si el dominio está como Local / Remote / Backup / Automatically Detect. No guardar cambios.
3. Si cPanel muestra **Local** para una cuenta que vive únicamente en Microsoft 365, investigar enrutamiento dividido; el hecho de que SMTP acepte el mensaje no significa entrega al buzón correcto.
4. Si cPanel muestra **Remote**, usar Exchange Admin Center → **Mail flow → Message trace** para buscar la misma hora, remitente y destinatario. Si Microsoft 365 no muestra rastro, revisar el destino real y respuesta del servidor SMTP saliente. Si lo muestra, examinar estado y motivos.
5. Si Exchange recibió el correo, comprobar **Microsoft Defender → Email & collaboration → Review → Quarantine**, junk mail, reglas de flujo, antispam y políticas antiphishing. No permitir de forma global todo el dominio ni deshabilitar protecciones.
6. Registrar estado actual de MX, SPF, DKIM y DMARC antes de proponer cambios. Un mismo dominio debe tener un solo registro TXT SPF efectivo que autorice los emisores necesarios. SPF valida el dominio del envelope sender (MAIL FROM); DKIM valida el dominio d= de la firma. DMARC requiere que al menos uno de ellos pase y esté alineado con el dominio del From visible. Un SPF correcto por sí solo no demuestra alineación DMARC.

### Consultas DNS opcionales desde PowerShell (solo lectura)

```powershell
Resolve-DnsName -Name iua.edu.mx -Type MX
Resolve-DnsName -Name iua.edu.mx -Type TXT
Resolve-DnsName -Name _dmarc.iua.edu.mx -Type TXT
```

**Limitación:** estos comandos no pueden demostrar cómo enruta mensajes *internamente* cPanel o Microsoft 365; esa información proviene de sus trazas y configuraciones.

## Evidencia mínima y correlación

Usar identificadores de caso y custodiar los destinatarios reales solo en el
registro operativo privado. Registrar por cada prueba: hora UTC con zona,
versión/SHA desplegado, flujo (invitación/recuperación), proveedor de destino,
Message-ID si está disponible, identificador de cola de cPanel, host siguiente,
respuesta SMTP, identificador/estado de Message Trace y resultado en el buzón.
Correlacionar Message-ID, destinatario y ventana horaria; un reintento es otro
caso. No pegar cuerpos, códigos, enlaces de activación, cookies, credenciales ni
cabeceras completas en GitHub. Sanitizar también los mensajes de rebote.

| Etapa | Lo que demuestra | Lo que falta comprobar |
| --- | --- | --- |
| Conexión TLS/SMTP autenticada | Acceso al servidor emisor | Aceptación del mensaje y ruta |
| sendMail sin error / respuesta 250 | Aceptación SMTP en esa etapa | Entrega posterior; puede existir rebote diferido |
| Track Delivery entregado a otro host | Transferencia al siguiente servidor | Recepción/filtrado en el destino |
| Message Trace entregado | Resultado de transporte en Exchange | Buzón/alias correcto, reglas, junk y cuarentena |
| Mensaje visible y código utilizable una sola vez | Recorrido funcional del caso | Repetir la matriz de proveedores y recuperación |

El servicio actual no expone una traza de entrega por destinatario ni conserva
el resultado completo de Nodemailer. No habilitar debug SMTP con cuerpos o
credenciales para obtenerla: usar las trazas del proveedor y una cuenta sintética.
No enviar una nueva invitación masiva como procedimiento de diagnóstico.

## Solución posterior según hallazgo

| Evidencia | Cambio propuesto | Validación |
| --- | --- | --- |
| cPanel entrega localmente a buzón que vive en Exchange | Diseñar *split delivery* con el proveedor y administradores de Exchange; configurar un encaminamiento selectivo para destinatarios M365. Revisar Accepted Domains (Internal relay) y conectores de Exchange solo si la arquitectura lo requiere. | cPanel no intercepta el mensaje y Exchange lo recibe; cPanel sigue recibiendo sus propios destinatarios |
| Exchange sí recibe pero bloquea | Ajustar la causa exacta de la política de filtrado, reputación o autenticación; sin listas permisivas globales | Trace + cuarentena + entrega correcta |
| SPF/DKIM/DMARC no alineados | Autorizar el emisor SMTP de cPanel en el SPF **único**, configurar DKIM del emisor y política DMARC consensuada | Authentication-Results de un correo real; todas las rutas de salida existentes siguen válidas |
| Buzón no existe o alias no definido | Corregir destinatario, alias o conector con el administrador del dominio | Mensajes a cuentas de prueba en ambos proveedores |

Si el mismo dominio tiene buzones reales en los dos proveedores, la modificación debe planificarse como cambio coordinado de correo institucional. **No puede resolverse únicamente con un cambio de HTML/código de verificación.**

## Prueba de aceptación y reversión

- Preparar respaldo/export de DNS y de la configuración de mail routing, conectores y reglas existentes antes de intervenir.
- Confirmar entrega de un correo legítimo desde SMTP cPanel a: buzón cPanel propio del dominio, buzón M365 propio del dominio y destinatario externo de prueba.
- Confirmar invitación y recuperación desde la plataforma sin cambiar expiración de códigos, contenido sensible o flujos de activación.
- Si algún buzón deja de recibir, revertir la configuración de enrutamiento afectada con el administrador responsable.

## Estado de cierre

Este documento completa el procedimiento del PR #111; no acredita que #107 esté
resuelta. Este entorno no tiene identidades ni credenciales de cPanel/Microsoft
365 ni del servidor SMTP. Las trazas, la entrega real y cualquier cambio de
correo quedan a cargo del operador autorizado. No se ha cambiado DNS, routing,
conectores, SMTP ni la expiración de códigos.

Cerrar la incidencia solo con la matriz de tres destinos correcta, invitación y
recuperación verificadas, evidencia sanitizada y plan de reversión comprobado.

## Fuentes operativas oficiales

- [cPanel Email Routing](https://docs.cpanel.net/cpanel/email/email-routing/)
- [cPanel Track Delivery](https://docs.cpanel.net/cpanel/email/track-delivery/)
- [Exchange Online: accepted domains](https://learn.microsoft.com/en-us/exchange/mail-flow-best-practices/manage-accepted-domains/manage-accepted-domains)
- [Exchange Message Trace](https://learn.microsoft.com/en-us/exchange/monitoring/trace-an-email-message/message-trace-modern-eac)

Relacionado: [#107](https://github.com/Marcor360/Sistema-Escolar/issues/107).
