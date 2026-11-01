# Dependencias de patrones y redirecciones · revisión 1/nov/2026

`follow-redirects` se fija en 1.16.2 (GHSA-mrwp-f3q8-3g9p). Los consumidores
modernos de `minimatch` (9+) y `glob` (9+) resuelven 11.0.3 y 14.0.3,
respectivamente, con las correcciones oficiales de amplificación de patrones
y cancelación de recorridos. No se reducen los controles de npm audit.

Los avisos GHSA-g3hv-75wg-m249 y GHSA-3g3m-2fjr-6pw4 incluyen rangos de
versiones anteriores a la introducción del código descrito. Las APIs antiguas
de minimatch 3/5 son funciones invocables; glob 7 conserva callbacks y eventos.
Sustituirlas por sus mayores actuales rompe ESLint, rimraf y ExcelJS.

Se conservan copias locales revisadas de minimatch 3.1.5/5.1.9 y glob 7.2.3.
**No son parches de seguridad ni publicaciones oficiales**: únicamente cambia
la versión en package.json a `-escolar.0`. Los archivos ejecutables y licencias
son idénticos a los tarballs oficiales. Estas versiones de minimatch no tienen
`firstPhasePreProcess`/`secondPhasePreProcess`, ni optimización de nivel 2.
Glob 7 no implementa `AbortSignal`: sus recorridos comprueban `this.aborted`.
Por ello no contienen los defectos descritos por esos dos avisos. Esta revisión
de aplicabilidad es limitada a esos avisos; futuros avisos requieren revisión.

`scripts/legacy-glob-manifest.json` conserva versiones y SHA-512 de los archivos
originales y locales. Para reproducir: `npm pack <nombre>@<upstreamVersion>`,
extraer, cambiar solamente `package.json.version` por `version`, y `npm pack`.
Comparar todos los archivos salvo package.json, conservar las licencias y
comprobar las integridades antes de actualizar el manifiesto.

`node scripts/check-glob-dependencies.cjs` verifica integridades, resolución
por workspace, APIs antiguas y límites de expansión de la versión moderna.
Los archivos locales se incluyen por workspace para permitir instalaciones
independientes. Los overrides de npm referencian dependencias directas para
conservar la resolución reproducible. CI ejecuta además audit, lint, tipos,
tests, compilaciones e integración; esto no acredita UAT institucional.
