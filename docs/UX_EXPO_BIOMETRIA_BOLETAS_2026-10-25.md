# UX Expo del alumno · protección, biometría y boletas · 1.27.43

## Estado anterior a esta propuesta
JWT de acceso de 15 minutos, refresh revocable, cierre de 30 minutos de inactividad, SecureStore para tokens, caché académica exclusiva de memoria por 5 minutos y limpia al cambiar identidad/sesión, alertas genéricas Expo Push y PDF/Excel del alumno a través de enlaces privados. La API valida que el alumno consulte su propio expediente; no hay funcionalidades docentes ni financieras de gestión en móvil.

## Cambios de experiencia
- **Acceso protegido:** el alumno activa voluntariamente huella/rostro desde Perfil si tiene biometría habilitada. SecureStore delega la autorización al sistema operativo. Al reabrir con sesión vigente se muestra una pantalla de desbloqueo, con alternativa para salir y prestar el dispositivo. No se guardan huellas, imágenes faciales ni contraseñas. Biometría no permite reabrir una sesión expirada.
- **Privacidad:** al cerrar sesión manualmente o invalidar tokens se limpia la caché académica en memoria, JWT de acceso y renovación, preferencia biométrica y preferencia local de avisos por cuenta; se descartan las notificaciones mostradas. Los documentos escolares no se guardan en disco de la aplicación.
- **Boletas:** diseño por tarjetas por materia, promedio destacado, botón principal PDF y Excel secundario, textos de descarga y estados de carga/error. Documentos solicita explícitamente la boleta informativa PDF con enlace firmado y descarga adjunta.
- **PDF superior:** encabezados y ocho columnas del machote recibido. Sin cambios en promedio oficial ni criterios de publicación; se exige cierre completo P1–P3 y acceso al propio alumno.

## Permisos y notificaciones
El permiso de notificaciones se solicita al activar avisos desde Perfil (Expo Notifications, Android/iOS), con acción explícita del alumno. Requiere build EAS física, project ID, certificados FCM/APNs y `PUSH_ENABLED=true` en la API para entrega. El servidor verifica sesión, alumno y dispositivo, y los avisos son genéricos sin calificaciones. Los tickets y recibos del proveedor deben verificarse en staging. No solicitar permisos de acceso global al almacenamiento: la apertura/descarga utiliza navegador/gestor de archivos del sistema sin leer galerías, fotos ni archivos ajenos.

## Matriz UAT pendiente
1. Android con huella e iOS con Face ID; sin sensor/enrolamiento y cancelación.
2. Logout y acceso de compañero: ninguna caché académica, token, pantalla privada o preferencia biométrica anterior.
3. Reabrir en sesión vigente: biometría. Tras más de 30 minutos inactivo: solicitar usuario y contraseña.
4. Red intermitente: solo caché de memoria propia hasta 5 minutos, nunca ante 401/403 ni de otro alumno.
5. Notificaciones autorizadas/denegadas, `PUSH_ENABLED=false`, credenciales EAS FCM/APNs, cambiar de usuario y recibos del proveedor.
6. Descargar PDF/Excel de boleta cerrada y propia, y contrastar columnas/filas/saltos con machote. Boleta incompleta: bloqueo 409. Validar iOS/Android y guardar vía OS.
7. Revisar accesibilidad (lectores de pantalla, zoom de texto, contraste) y funcionamiento con internet intermitente.

## Límites
No existe caché persistente de expedientes de menores ni documentos descargados offline. No se añade biblioteca externa para biometría ni permisos amplios de almacenamiento. Sin migraciones, rutas de roles docentes/administrativos ni cambios ajenos a las boletas. No considerar esta rama publicada hasta CI, QA Android/iOS y UAT staging.
