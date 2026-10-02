# Excepción temporal de npm audit móvil

Al 2 de octubre de 2026, Expo 56 incorpora `node-forge@1.4.0` a través de `@expo/cli` y `@expo/code-signing-certificates`. npm reporta GHSA-86w9-cpqp-85rv como alta y no ofrece una versión corregida de `node-forge`; su propuesta automática baja Expo a 44, lo que rompería la compatibilidad con la aplicación actual.

El job móvil permite únicamente esa cadena de cuatro paquetes y verifica que la causa siga siendo ese aviso. Falla si aparecen otras vulnerabilidades altas/críticas y también si la excepción deja de coincidir, para retirar el permiso tras una actualización de Expo. La revisión de `backend` y `web` usa `npm audit` sin excepciones.
