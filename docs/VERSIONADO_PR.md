# Política de versiones por pull request

**Corte: 18/oct/2026.** La versión ya existente en `main` es **1.26.1**. La siguiente entrega debe ser **1.26.2**, no otra 1.26.1.

## Numeración

Cada PR que vaya a integrarse incrementa la versión respecto de **su rama base**: 1.26.2 → 1.26.3 → 1.26.4 para entregas pequeñas; una ampliación grande, coordinada y validada, cambia a 1.27.0. No volver a utilizar un identificador ya fusionado, aunque el código no haya sido desplegado. Los PR simultáneos no reservan versiones: si otro PR se fusiona primero, rebasar, renumerar y volver a validar. Los PR apilados se integran en orden.

Cada entrega deberá actualizar **backend, web y mobile** en sus `package.json`, los tres `package-lock.json`, `mobile/app.json`, `docs/BETA_ACEPTACION.json`, `docs/UAT_MATRIZ_2026-10-15.json` y la versión candidata en `README.md`, con una descripción específica de alcance. No reescribir versiones de evidencias históricas.

En título/cuerpo del PR, especificar versión, propósito, archivos/módulos, validaciones ejecutadas, impacto de base de datos, migraciones, riesgos, alcance por rol y limitaciones de despliegue. Un merge no cambia IIS, el Windows Server ni una app móvil instalada.

## Controles

`scripts/check-project-consistency.cjs` comprueba que todas las versiones del monorepo coincidan. Adicionalmente `scripts/check-pr-version.cjs` compara la versión candidata con la de la rama base en CI; exige **mayor versión semántica sin sufijos**. El backend de GitHub Actions descarga historial (`fetch-depth: 0`) para disponer de `origin/<rama-base>`. El comparador dispone de pruebas `scripts/check-pr-version.test.cjs`.

Si un PR anterior sigue abierto al entrar en vigor el control, debe actualizarse a una versión superior a la que esté en su rama base. La comprobación relativa no reemplaza la revisión humana del tipo de incremento.

## Registro inicial

| Versión | Contenido | Estado |
| --- | --- | --- |
| 1.26.1 | Seguridad de cuentas, cartera/catálogos consolidados y UX previa | Ya en main antes de este PR |
| 1.26.2 | Política de versiones y mapa de ejemplos académicos | Propuesta; no desplegada |
| 1.26.3 | Guía contextual de ciclos en web y acceso a grupos por ciclo | PR apilado sobre 1.26.2; sin despliegue |
| 1.26.4 | Vigencia de ciclo y contexto visible de cotización en apertura de cartera | PR apilado sobre 1.26.3; sin despliegue |
| 1.26.5 | Consulta propia paginada en API y Expo | PR apilado; sin despliegue |
| 1.27.0 | Temario como nuevo dominio con API/migraciones/web | Requiere PR separado, pruebas y aceptación |

No confundir `versión`, número de PR GitHub, SHA integrado o versión de servidor: son identificadores distintos.
