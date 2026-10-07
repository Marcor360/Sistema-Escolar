# Excepciones temporales de npm audit móvil

Al 2 de octubre de 2026, Expo 56 y React Native 0.85.3 conservan dos avisos altos en dependencias transitivas de sus herramientas:

| Aviso | Paquete raíz | Ruta observada | Motivo de la excepción |
|---|---|---|---|
| `GHSA-86w9-cpqp-85rv` | `node-forge@1.4.0` | `expo` → `@expo/cli` → `@expo/code-signing-certificates` | La versión compatible de Expo aún no incorpora una corrección. |
| `GHSA-vfj7-8cjw-p6xm` | `braces@3.0.3` | Expo/React Native → Metro y `@expo/metro-file-map` → `micromatch` | El aviso no declara versión corregida; npm propone bajar Expo a 44, incompatible con esta app. |

El segundo aviso afecta el procesamiento de patrones en las herramientas Metro usadas para empaquetar la app. No se expone ese procesamiento como endpoint de la API, pero sigue siendo una dependencia vulnerable del entorno de construcción. No se considera remediada.

`scripts/check-mobile-audit.cjs` permite solo los identificadores npm `1240912` y `1240992`, sus URLs GHSA y las cadenas transitivas observadas. Cualquier aviso alto/crítico nuevo o paquete inesperado vuelve rojo el job. Si una actualización elimina uno de los avisos, el script deja de incluirlo entre las excepciones activas; se debe retirar entonces su entrada y actualizar este documento.

Backend y Web usan `npm audit` completo, sin excepciones. Se actualizaron Jest y TypeScript ESLint para eliminar su dependencia de `braces`.

## Reevaluación al 3 de octubre de 2026

El audit actual sigue identificando `braces@3.0.3` y `node-forge@1.4.0`; el registro npm no ofrece una versión más nueva de esos paquetes al revisar. Las 17 alertas altas son rutas duplicadas/transitivas de esos dos avisos, no 17 causas raíz distintas. No se aplicó `npm audit fix --force`, que propone degradar Expo a una versión incompatible.

La app sigue en Expo SDK 56 / React Native 0.85. La matriz oficial documenta SDK 57 con React Native 0.86 y Node 22.13; subir el SDK requiere actualizar el runtime de CI y validar de nuevo el build nativo. Como los paquetes vulnerables no tienen versión corregida publicada, esa actualización por sí sola no garantiza cerrar los avisos. Reevaluar esta excepción al actualizar SDK o cuando npm publique versiones corregidas. Referencias: [matriz oficial de versiones Expo](https://docs.expo.dev/versions/latest/) y [guía oficial de actualización](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).

## Reevaluación al 6 de octubre de 2026

La app se actualizó a Expo SDK 57 / React Native 0.86.3. `expo-doctor` pasó sus 21 comprobaciones; TypeScript, pruebas y export Android pasaron localmente. `check-mobile-audit.cjs` todavía informa las excepciones activas `GHSA-86w9-cpqp-85rv` y `GHSA-vfj7-8cjw-p6xm`; **no están resueltas**. La base de avisos de GitHub las clasifica como altas y no indica versiones corregidas al momento de la revisión: [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv) y [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Quedan pendientes el build nativo firmado y la prueba física en Android/iOS.

## Reevaluación de la Fase 1 al 7 de octubre de 2026

El audit del lockfile de Expo SDK 57 propaga los mismos dos avisos raíz a 37
paquetes: aparecen también las cadenas de plugins Expo y React Navigation que
dependen de Expo/React Native. Se actualiza únicamente la lista cerrada de
paquetes transitivamente afectados. Se conservan los IDs y URLs exactos de
los dos avisos; cualquier causa raíz alta/crítica distinta continúa bloqueando
CI, aunque aparezca en un paquete de la lista. No se desactiva audit ni se
aplica `--force`. El registro sigue publicando `braces@3.0.3` y
`node-forge@1.4.0` como últimas versiones; las excepciones siguen sin remediar.

## Remediación en la ampliación 1.15.0 — 7 de octubre de 2026

Se retiran las excepciones activas. `check-mobile-audit.cjs` exige cero avisos, incluidos moderados y bajos. Se mantienen las secciones anteriores como historial.

El registro npm todavía publica `braces@3.0.3` y `node-forge@1.4.0` sin corrección oficial. `mobile/vendor` contiene archivos npm de versiones **locales**, parches fuente revisables e integridad SHA-512 del origen; no son versiones publicadas por los proveedores:

- `braces@3.0.4-escolar.0`: limita a 100 niveles el parser y los recorridos compile/expand/stringify, incluidos AST recibidos directamente. Basado en el diagnóstico de [braces #70](https://github.com/micromatch/braces/issues/70).
- `node-forge@1.4.1-escolar.0`: exige el número exacto de elementos de DigestAlgorithm (OID y NULL opcional), como propone [forge PR #1152](https://github.com/digitalbazaar/forge/pull/1152). El PR aún no está integrado oficialmente. Se excluyen del paquete los bundles dist sin parche.

`verificar-parches-mobile.cjs`, ejecutado antes de las pruebas, comprueba rangos y patrones normales, anidación excesiva de patrones/AST, firmas RSA válidas con y sin NULL y rechazo de elementos ASN.1 adicionales. Los paquetes se fijan por archivo e integridad en package-lock, sin desactivar TLS ni verificación de npm.

Mantenimiento: comprobar las publicaciones oficiales antes de cada actualización de Expo; sustituir cada fork por la versión oficial que cierre el aviso y repetir regresiones, audit y build Android. Los parches se usan en las herramientas Expo/Metro; requieren también validación del build nativo firmado al disponer de credenciales EAS.
