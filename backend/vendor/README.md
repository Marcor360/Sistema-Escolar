# Dependencias locales revisables

## deepmerge 4.3.2-escolar.0

Copia idéntica del tarball corregido usado por móvil, necesaria para instalar backend por separado. [Fuente y parche](../../mobile/vendor/deepmerge-4.3.2-escolar.0.patch), [reproducción y política](../../mobile/vendor/README.md), [aviso](https://github.com/advisories/GHSA-gcqx-w48m-w2h4). `deepmerge-upstream.json` conserva integridades y versión de origen. La licencia MIT se conserva en el tarball.

El override aplica la corrección a Jest y al checker de Nest; `scripts/verificar-deepmerge.cjs` comprueba resolución desde ambos consumidores, integridad y regresiones de configuración/prototipos antes de las pruebas. No es una versión oficial publicada.
