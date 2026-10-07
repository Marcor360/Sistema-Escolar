# Parches temporales de herramientas Expo / Metro

Los tarballs contienen el código npm original más los cambios de los archivos `.patch`. Se conservan sus licencias. Son versiones locales, no publicaciones oficiales.

El origen y SHA-512 están en `upstream.json`. Para reproducir: descargar con `npm pack braces@3.0.3` y `npm pack node-forge@1.4.0`, verificar el hash contra el manifiesto, extraer, aplicar el `.patch` correspondiente con `patch -p1`, cambiar únicamente la versión a la indicada y empaquetar con `npm pack --ignore-scripts`. En node-forge, limitar `files` a `lib/*.js` para excluir los bundles dist sin corregir. Mantener TLS y la verificación de integridad.

Las regresiones ejecutables están en `../../scripts/verificar-parches-mobile.cjs`. La evidencia y la política de sustitución por correcciones oficiales se documentan en `../../docs/EXCEPCIONES_NPM_AUDIT.md`.
