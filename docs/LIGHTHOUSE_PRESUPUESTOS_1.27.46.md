# Presupuestos Lighthouse del portal IUA

**Propuesta 1.27.46**, separada de los PR de recorridos integrados y axe-core.

El workflow `.github/workflows/lighthouse-budget.yml` compila Vite desde el lockfile y mide `/login` en modo móvil, 3 pasadas por SHA. El portal **no tiene backend real** ni sesiones ni datos de alumnos. `web/lighthouserc.cjs` define los umbrales iniciales de laboratorio:

| Métrica | Umbral | Acción |
| --- | ---: | --- |
| Rendimiento Lighthouse | >= 0.65 | Aviso; requiere línea base estable |
| Accesibilidad Lighthouse | >= 0.80 | Aviso; revisar también con axe y pruebas manuales |
| First Contentful Paint | <= 3500 ms | Aviso |
| Largest Contentful Paint | <= 7000 ms | **Error** |
| Total Blocking Time | <= 1500 ms | **Error** |
| Cumulative Layout Shift | <= 0.25 | **Error** |

Los umbrales son **presupuestos iniciales propuestos**, no mediciones de rendimiento real ni metas institucionales aprobadas. Ajustarlos con resultados de CI y después de establecer una línea base, sin empeorarlos arbitrariamente. No miden funciones protegidas por sesión, red institucional, dispositivos físicos ni Android/iOS.

**Ejecución:** Actions `Presupuestos Lighthouse IUA` se ejecutará en PRs con cambios web, manualmente o los viernes después del merge. Instala `@lhci/cli@0.15.1` solamente en el runner. `lhci collect` y `lhci assert` validan, `lhci upload` usa **filesystem** para evitar reportes públicos; GitHub Actions adjunta HTML/JSON. No requiere token LHCI.

**Despliegue:** Ninguno. No actúa en IIS ni altera base de datos y no sustituye UAT. Comprobar los resultados del SHA del PR antes de fusionar.
