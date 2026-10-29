# App del alumno en navegador · candidata 1.33.0

La misma aplicación React Native/Expo se exporta para Android y navegador con React Native Web. No se añade un panel administrativo. Se mantiene su uso exclusivo para alumnos y las reglas académicas/financieras siguen en la API.

## Preparar y abrir

Desde `mobile/`: `npm run web` inicia Metro con navegador. `APP_ENV=preview EXPO_PUBLIC_API_URL=https://tu-api-institucional/api npm run build:web` genera `mobile/dist/` para hosting web. `npm run build:android` exporta el bundle nativo; no genera por sí solo un APK firmado. Los perfiles EAS existentes siguen en `eas.json` para APK interno y producción. No se publicaron builds ni se usaron credenciales institucionales.

En desarrollo puede usarse HTTP local. En preview/producción la API requiere HTTPS y `/api`. El origen de la app web debe estar en `CORS_ORIGINS`, con credenciales habilitadas; se recomienda alojar web/API bajo el mismo sitio para la cookie SameSite Strict. La app usa el contrato WEB existente: refresh HttpOnly y token de acceso únicamente en memoria. No guarda tokens en localStorage/sessionStorage. Android/iOS mantienen Keychain/Keystore y el contrato MOVIL. Al recargar el navegador se solicita nuevamente el acceso; no se promete persistencia web entre recargas.

## UX/UI y compatibilidad

Aplicadas las skills locales `iua-expo-alumno` e `iua-auditoria-ux-accesibilidad`. Se conservan las cinco pestañas, la marca configurable, ancho de lectura y rejillas adaptables. Los sellos aumentan de 10 a 12 puntos. Las confirmaciones web utilizan un diálogo con foco, Escape y retorno al control de origen. La actividad de teclado y puntero también alimenta el límite de inactividad del navegador. Perfil explica que push y biometría requieren la app instalada, sin ofrecer acciones nativas inoperantes en web.

Se actualizaron dependencias compatibles de navegación, Expo 57, notificaciones, Axios, Nest 11, mysql2, nodemailer y herramientas de lint/formato/pruebas. Se conservan React/RN compatibles con la matriz Expo; no se fuerza una migración a Expo 58, React Native 0.88, React 19 en el portal administrativo ni Nest 12. La consulta remota de compatibilidad Expo fue bloqueada por la red del entorno; el chequeo offline usa la matriz incluida en el SDK y no acredita validación remota.

## Validación

Verificación local: 27 archivos / 142 pruebas del cliente móvil y 11 comprobaciones de scripts aprobadas; TypeScript móvil sin errores. Exportaciones Metro web y Android aprobadas. Recorrido Chromium con API simulada en 360/768/1280/1920 px: entrada, navegación de las cinco pestañas, confirmación/cancelación de cierre de sesión y ausencia de errores JavaScript/desbordamiento global. Backend: lint/typecheck y 571 pruebas aprobadas; portal web: lint, build y 265 pruebas aprobadas tras actualizar dependencias. npm audit reporta cero vulnerabilidades en los tres proyectos. Consistencia de versión 1.33.0 y migraciones espejo aprobada; no hay nueva migración por este cambio. Se incorpora la exportación web a CI, sin acreditar una ejecución remota de un SHA nuevo.

`npm run test:web` desde `mobile/` ejecuta el recorrido del bundle web previamente exportado; requiere dependencias de `web/` y Chromium instalado para Playwright. Usa un servidor local temporal en el puerto 5190 y datos ficticios. En esta ejecución se usó `/usr/bin/chromium`; no es una prueba contra los servicios institucionales. Todos los datos de navegador son ficticios; no se enviaron correos, tareas ni pagos reales. Una exportación no equivale a APK/IPA firmado, instalación física ni publicación. Continúan pendientes las aceptaciones institucionales y UAT en Android/iOS.

## Corrección de entrada en 1.34.0

El recorrido 1.33.0 con API simulada no detectaba el rechazo de ALUMNO en el login WEB administrativo. La candidata [1.34.0](BOLETAS_FIRMADAS_1.34.0.md) incorpora una entrada exclusiva `/auth/login-alumno-web`, cookie HttpOnly y renovación de alumno web, verificadas contra API y bases desechables. No usar la ruta administrativa para el acceso del alumno en navegador.
