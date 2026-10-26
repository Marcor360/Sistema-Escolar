# Correos claros y UX de acceso/Inicio · 1.27.55

Esta entrega se apila sobre #203 (1.27.54), abierto al iniciar el trabajo. Integrar primero esa entrega. No requiere DDL adicional; conserva las migraciones de su base. No cambia roles, proveedores ni reglas de evaluación.

## Correos y recorrido de acceso

| Evento | Destinatario y contenido | Enrutamiento y prueba |
|---|---|---|
| Activación | Titular: primer acceso, pasos numerados, código completo de 64 caracteres, contraseña personal, vigencia y ayuda | Outbox duradero; preferencia actual GoDaddy/Microsoft 365; pruebas de plantilla y flujos existentes |
| Recuperación | Titular: contraseña todavía sin cambio, código de 32 caracteres, pantalla correcta, uso único y solicitud no reconocida | Mismo outbox, coalescencia y token vigente; no se renueva la caducidad por solicitar otra vez |
| Apoyo de acceso | Personal autorizado del plantel: cuenta solicitante, verificación de identidad y orientación; solicitud no demuestra cambio ni pérdida de acceso | Mismos destinatarios y preferencia por cuenta; plantilla con marca y texto escapado; sin código ni contraseña |
| Cobranza | Se conserva la plantilla AVISO_ADEUDO administrada en base de datos | No se sobrescriben textos institucionales configurados ni se modifican importes, destinatarios o preferencias |

El código aparece antes de los pasos largos para localizarlo rápido. Activación y recuperación añaden resumen en la vista previa del correo, jerarquía visual, pasos, caducidad y ayuda. Conservan la marca configurable, contraste del encabezado, HTML sin recursos externos y escape de contenido. No hay enlaces construidos con dominios inferidos ni secretos en URL. No se afirma que aceptación SMTP/Graph acredite recepción.

El error del código de recuperación deja de decir «Token inválido» y explica código rechazado/usado/vencido y siguiente acción. Las respuestas de solicitud siguen siendo genéricas; no revelan existencia de cuentas. Se mantienen hash, consumo único, revocación y límites del servidor.

## Expo ALUMNO

- Login incluye «¿Olvidaste tu contraseña?». Reutiliza el flujo de acceso con tres pasos: correo, código de recuperación y nueva contraseña con confirmación. Activación conserva 64 caracteres y recuperación usa 32; sus endpoints y preferencia de espera son distintos.
- «Ya tengo un código» permite continuar sin solicitar otro correo. Revisar/cambiar correo limpia secretos. Contador de espera de 60 segundos por modo/correo para evitar toques repetidos; es ayuda del cliente, no reemplaza límites/coalescencia del backend.
- Contraseñas ocultas inicialmente, opción mostrar/ocultar, autocompletado nuevo, validación de coincidencia, botón ocupado y bloqueo inmediato de doble toque. Mensajes de éxito claros y limpieza de código/contraseñas tras guardar. No inicia sesión de forma automática.
- Foco del teclado desde correo a contraseña en Login. Controles táctiles, texto ampliable, desplazamiento con teclado y lectores de pantalla requieren comprobación física.
- Mis pendientes aparece antes del resumen de Inicio; tarjetas con accesos a actividades y pagos cuando corresponde. Faltas son información, no sanciones automáticas. Error, carga y consulta vacía se distinguen; una actualización fallida identifica datos previos.

## Web

Recuperación en dos pasos con títulos, ayuda de 32 caracteres y diferenciación del código de activación. Normaliza espacios externos/mayúsculas del código, añade autocompletado y borra secretos al terminar. Deshabilita cambios de flujo mientras envía. Se conservan rutas y contratos; no cambia el mecanismo de sesión.

## Aceptación y siguiente etapa de UX

UAT-42–44 quedan pendientes. Pruebas con mocks y compilación no acreditan recepción en Outlook/Gmail, tamaño de letra nativo, TalkBack/VoiceOver ni instalación Android/iOS.

Revisar en orden: entrada desde el correo real con copia completa del código; teclado y texto ampliado; conexión lenta y código vencido; tareas/archivos y comprobación de entrega; después navegación y filtros de calificaciones/pagos. Para ampliar el rediseño conviene observar estos recorridos con alumnos reales autorizados antes de cambiar toda la aplicación.

## Verificación local

Backend: lint/typecheck/build y 487 pruebas aprobadas; comprobación final de siete pruebas de plantillas. Web: lint/build y 232 pruebas aprobadas, más recuperación/activación y pasada completa adaptable. Mobile: TypeScript, 126 pruebas Vitest y 11 Node aprobadas, exportación Android completada. HTML de activación y recuperación revisado con códigos sintéticos a 320/768 px sin desbordamiento global. Consistencia de 316 consultas cliente con 311 rutas API, beta/UAT y versión 1.27.54 → 1.27.55 correctas. Integraciones MySQL/SQL Server locales no repetidas en esta entrega sin DDL; CI debe comprobar el SHA final. No se enviaron correos reales ni se aplicaron cambios a bases institucionales.
