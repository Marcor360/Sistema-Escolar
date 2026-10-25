# Correos de acceso con marca institucional · 1.27.42

El proceso outbox consulta `ConfiguracionService.obtener()` antes de cada envío de activación o recuperación. Así se aplican los colores y nombre de marca configurados desde el portal web. Los mensajes enviados previamente NO cambian retroactivamente.

## UAT pendiente en staging

1. Cambiar color primario y de acento desde Configuración.
2. Solicitar envíos nuevos de activación y recuperación a usuarios de prueba.
3. Verificar HTML recibido en cuentas GoDaddy y Microsoft 365, en móvil y escritorio. Confirmar contraste, remitente y nombre.
4. Revisar que el proveedor realmente haya aceptado y entregado el correo. Validar de nuevo después de desplegar el backend; el merge por sí solo no actualiza staging.

Sin migraciones ni cambios al flujo de activación, proveedor de correo o permisos.
