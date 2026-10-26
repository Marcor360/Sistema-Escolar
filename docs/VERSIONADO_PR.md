# Política de versiones por pull request

**Corte: 26/oct/2026.** Esta entrega propone **1.27.53** sobre `main` **1.27.52**. Consultar siempre la versión de la rama base remota; los títulos de PR no reservan versiones. La versión objetivo 1.28.0 del reglamento sigue pendiente de aprobación y desarrollo.

## Numeración

Cada PR que vaya a integrarse incrementa la versión respecto de **su rama base**: 1.26.2 → 1.26.3 → 1.26.4 para entregas pequeñas; una ampliación grande, coordinada y validada, cambia a 1.27.0. No volver a utilizar un identificador ya fusionado, aunque el código no haya sido desplegado. Los PR simultáneos no reservan versiones: si otro PR se fusiona primero, rebasar, renumerar y volver a validar. Los PR apilados se integran en orden.

Cada entrega deberá actualizar **backend, web y mobile** en sus `package.json`, los tres `package-lock.json`, `mobile/app.json`, `docs/BETA_ACEPTACION.json`, `docs/UAT_MATRIZ_2026-10-15.json` y la versión candidata en `README.md`, con una descripción específica de alcance. No reescribir versiones de evidencias históricas.

En título/cuerpo del PR, especificar versión, propósito, archivos/módulos, validaciones ejecutadas, impacto de base de datos, migraciones, riesgos, alcance por rol y limitaciones de despliegue. Un merge no cambia IIS, el Windows Server ni una app móvil instalada.

## Controles

`scripts/check-project-consistency.cjs` comprueba que todas las versiones del monorepo coincidan. Adicionalmente `scripts/check-pr-version.cjs` compara la versión candidata con la de la rama base en CI; exige **mayor versión semántica sin sufijos**. El backend de GitHub Actions descarga historial (`fetch-depth: 0`) para disponer de `origin/<rama-base>`. El comparador dispone de pruebas `scripts/check-pr-version.test.cjs`.

Si un PR anterior sigue abierto al entrar en vigor el control, debe actualizarse a una versión superior a la que esté en su rama base. La comprobación relativa no reemplaza la revisión humana del tipo de incremento.

## Historial

La historia de versiones y PR se consulta en Git y GitHub. Los resúmenes retirados conservan [enlaces al contenido original](HISTORIAL.md). La versión de código, el número de PR, el SHA y la versión de servidor son identificadores distintos. Un merge no acredita despliegue.
