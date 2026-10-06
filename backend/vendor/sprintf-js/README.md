# Parche temporal de sprintf-js

Origen: `sprintf-js@1.1.3` de [alexei/sprintf.js](https://github.com/alexei/sprintf.js), licencia BSD-3-Clause incluida.

La única modificación funcional en `src/sprintf.js` limita la precisión numérica a los rangos aceptados por `Number#toFixed`, `Number#toExponential` y `Number#toPrecision`. Corrige la condición descrita en [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c). Al 5 de octubre de 2026 el aviso no tenía una versión oficial corregida y `tedious@20.3.3` seguía requiriendo `sprintf-js@^1.1.3`.

El tarball vecino está fijado por integridad en `backend/package-lock.json`; `npm ci` instala exactamente ese contenido. Para regenerarlo después de revisar un cambio de fuente, ejecutar desde `backend/`:

```sh
npm pack ./vendor/sprintf-js --pack-destination vendor
npm install --package-lock-only
npm ci
npm audit
npm test
```

Retirar este parche cuando exista una versión oficial que corrija el aviso y pase integración MySQL y SQL Server. No se cambian las versiones principales de `mssql` ni `typeorm` por este aviso: ambas admiten el árbol actual y una actualización mayor por sí sola todavía conserva la dependencia vulnerable.
