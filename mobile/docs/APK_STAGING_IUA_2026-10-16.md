# APK de prueba: API HTTPS de staging

La aplicación del alumno usa la API NestJS; no abre una conexión a MySQL ni incorpora perfiles administrativos.

## Configuración

URL base conocida del entorno staging:

```dotenv
EXPO_PUBLIC_API_URL=https://api-sistema-staging.iua.edu.mx/api
APP_ENV=preview
```

El perfil `preview` en `mobile/eas.json` genera un APK para distribución interna. La URL se incorpora al bundle en el momento de compilar; no incluye secretos. Para configurar EAS usa el entorno `preview` y establece allí `EXPO_PUBLIC_API_URL` con el valor anterior. No modifiques el perfil `production` para apuntar a staging.

Antes de distribuir:

1. Desde la red móvil del teléfono verifica HTTPS/TLS y `GET https://api-sistema-staging.iua.edu.mx/api/health/live` y `/api/health/ready` (respuestas 200).
2. Comprueba login, refresh, cierre de sesión y revocación de sesión con una cuenta ALUMNO de prueba.
3. Comprueba materias, tareas, calendario, calificaciones, boleta PDF, biblioteca autorizada y estado de cuenta; no exhibas datos reales en capturas.
4. Simula conexión intermitente y falta de red; la app no debe mostrar datos de otro alumno.
5. Confirma en el servidor `UPLOADS_DIR` persistente, la ruta HTTPS de recursos firmados y que IIS/ARR enruta correctamente los recursos públicos de marca.
6. Valida en un dispositivo físico antes de considerar la beta aceptada.

La disponibilidad HTTPS externa actual **no está certificada por este cambio**; el despliegue sigue sujeto a verificaciones en staging.
