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
