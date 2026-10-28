# Parches temporales de herramientas Expo / Metro

Los tarballs contienen el código npm original más los cambios de los archivos `.patch`. Se conservan sus licencias. Son versiones locales, no publicaciones oficiales.

El origen y SHA-512 están en `upstream.json`. Para reproducir: descargar con `npm pack braces@3.0.3` y `npm pack node-forge@1.4.0`, verificar el hash contra el manifiesto, extraer, aplicar el `.patch` correspondiente con `patch -p1`, cambiar únicamente la versión a la indicada y empaquetar con `npm pack --ignore-scripts`. En node-forge, limitar `files` a `lib/*.js` para excluir los bundles dist sin corregir. Mantener TLS y la verificación de integridad.

Las regresiones ejecutables están en `../../scripts/verificar-parches-mobile.cjs`. La evidencia y la política de sustitución por correcciones oficiales se documentan en `../../docs/EXCEPCIONES_NPM_AUDIT.md`.

## deepmerge — 28/oct/2026

`deepmerge@4.3.2-escolar.0` parte de npm 4.3.1 y corrige localmente [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4). Al revisar, npm sigue publicando 4.3.1 y el aviso no declara una versión oficial corregida. El parche elimina `__proto__` tanto de target como de source y escribe propiedades propias mediante `Object.defineProperty`, evitando setters heredados. Incluye fuente, CommonJS y UMD; mantiene la licencia MIT.

Reproducir con `npm pack deepmerge@4.3.1 --ignore-scripts`, verificar `upstreamIntegrity`, extraer, aplicar `deepmerge-4.3.2-escolar.0.patch` con `patch -p1` (incluye la versión local) y ejecutar `npm pack --ignore-scripts`. `upstream.json` registra hashes de origen y tarball modificado. El override de npm fija la misma copia para `@expo/config`.

Las regresiones cubren envenenamiento desde target y source con prototipo nulo, clone activado/desactivado, setters heredados, merges normales, arrays y símbolos; comprueban la resolución real desde Expo y ambos bundles. Reemplazar este fork por una corrección oficial cuando exista y repetir audit, regresiones y export Android.
