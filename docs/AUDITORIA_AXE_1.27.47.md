# Auditoría automatizada axe-core de IUA

**Propuesta 1.27.47, independiente del PR de recorridos funcionales**.

- `web/test/a11y-audit.cjs` aplica **axe-core 4.14.0** al navegador Chromium ya utilizado por `web/test/responsive.cjs`, cuando `RUN_AXE_AUDIT=1`.
- Inspecciona login, inicio, expedientes con formulario de alta y vista de Finanzas; usa datos de prueba y respuestas API simuladas.
- Ejecuta reglas etiquetadas WCAG 2 A/AA, 2.1 AA y 2.2 AA. Genera `web/.qa/axe-report.json` con IDs, gravedad, cantidad de nodos y selectores de prueba; GitHub Actions conserva el resultado como artefacto.
- Workflow `.github/workflows/axe-accessibility.yml`: PRs que cambian web, ejecución manual y miércoles en rama por defecto después de merge.
- El auditor está fijado como dependencia de desarrollo en `web/package.json` y su lockfile; `npm ci` instala exactamente esa versión para CI y desarrollo. No forma parte del bundle de estudiantes.
- `A11Y_STRICT=0` por defecto: recopila la línea base real antes de activar bloqueo. Para fallar por hallazgos `serious` o `critical`, usar `A11Y_STRICT=1` y aprobar excepciones documentadas.
- Este proceso NO reemplaza pruebas manuales WCAG, lector de pantalla, navegación completa con teclado o la validación institucional.

Ejecución local con dependencias web y Playwright instalados:

```bash
cd web
npm ci
RUN_AXE_AUDIT=1 npm run test:responsive
```

**Seguridad:** solo `127.0.0.1`, sin credenciales ni datos de menores reales; jamás auditar páginas internas de staging con sesiones activas desde GitHub Actions.

## Línea base local de la revisión (25/oct/2026)

Chromium, axe-core 4.14.0 y API simulada completaron el recorrido responsive y los cuatro escenarios: acceso y alta de alumno sin infracciones detectadas; inicio con `color-contrast` serio en 19 nodos y Finanzas con la misma regla en 6 nodos. Los nodos incluyen el monograma y títulos de grupos del menú. No son 25 defectos independientes: las pantallas comparten elementos. El modo informativo conserva estos hallazgos para remediación; no permite afirmar conformidad WCAG ni aceptación institucional.
