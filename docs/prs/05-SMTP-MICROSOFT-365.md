# Entrega SMTP mixta: cPanel y Microsoft 365

## Evidencia y límite
`backend/src/notificaciones/notificaciones.service.ts:111-124` utiliza `transporter.sendMail` (aceptación SMTP de salida), **no** verifica recepción. Ya se fusionó #111 con la guía diagnóstica; esta entrega prepara la matriz de ejecución y criterios operativos restantes. No contiene cambios DNS ni credenciales.

## Prueba de campo controlada
Preparar tres destinatarios de prueba consentidos: buzón cPanel del dominio, buzón Exchange Online del **mismo dominio** y dirección externa Outlook.com.
Para cada intento registrar UTC, identificador SMTP no sensible, host emisor, estado Track Delivery cPanel, estado Message Trace Exchange, Inbox/Junk/Quarantine y resultado final. Nunca registrar OTP, tokens, contraseñas ni direcciones completas en evidencia pública.

## Secuencia de diagnóstico
1. Verificar dominio exacto, MX, SPF, DKIM, DMARC y encabezados Authentication-Results en consultas de solo lectura.
2. Revisar Email Routing en cPanel: local/remoto/auto detectado; confirmar si resuelve buzones M365 como destinatarios locales.
3. Ejecutar Track Delivery y Message Trace para la misma prueba UTC; comprobar cuarentena Microsoft Defender.
4. Si hay split delivery, diseñar ruta por destinatario/accepted domain con responsables de ambos servicios **antes** de cambiar MX, conectores o Email Routing.
5. Repetir invitación y recuperación reales; comprobar recepción y uso único sin alterar seguridad OTP.

## Criterios de aceptación
- Llegada comprobada en los tres buzones, o resultado técnico sustentado por las trazas y un cambio reversible documentado.
- No romper buzones cPanel; SPF/DKIM/DMARC siguen válidos.
- La plataforma no presenta la aceptación del SMTP como prueba de entrega al Inbox.

## Bloqueos
Acceso controlado a cPanel Track Delivery, Exchange Message Trace y DNS. **El PR no puede dar por resuelta la incidencia sin esas pruebas externas.**

Relación: #107 y guía ya fusionada de #111.

## Implementación y evidencia pendiente
El servicio comprueba ahora que Nodemailer haya aceptado destinatarios y no haya rechazados; un rechazo parcial no se registra como éxito. Registra únicamente un UUID de correlación local y el estado ACEPTADO_SMTP, sin direcciones, respuesta SMTP, asunto, cuerpo ni tokens. Conserva el contrato simulado y los reintentos existentes. Una aceptación SMTP nunca acredita Inbox. Las pruebas usan transporte simulado y SMTP local, sin enviar correo institucional.

La aceptación externa sigue pendiente de accesos y tres buzones consentidos. Registrar en evidencia privada: caso, UTC, SHA, flujo, proveedor, Message-ID del proveedor, Track Delivery, Message Trace, carpeta final y resultado de uso único. No cerrar #107 ni declarar resuelto este PR como incidencia operativa hasta disponer de las trazas.

El UUID local se transmite en la cabecera `X-Sistema-Correlacion`; cuando no existe Message-ID estable del flujo, también se utiliza como Message-ID sin datos personales. Se conserva el Message-ID estable de cobranza. El operador puede correlacionar únicamente esa cabecera y la hora en las trazas, sin publicar cabeceras completas ni códigos.
