# Modernización UX 1.20.0 — Fase 2

## Cambios
- Tipografía fluida y espaciados visuales en CSS.
- Tamaños táctiles mínimos y campos de formularios flexibles.
- Tablas anchas con contenedor desplazable para evitar cortar celdas.

## No incluido
No se modifican contratos, endpoints, datos, permisos ni migraciones.

## Pendiente de certificar antes del merge
- Lint, typecheck, build y pruebas automatizadas en CI.
- Capturas comparativas en 320, 360, 768, 1024, 1440, 2560 y 3840 px.
- Accesibilidad WCAG AA, formularios largos, zoom al 200 %, overflow y navegación con teclado.

## Reversión
Revertir esta fase restituye los estilos previos sin afectar datos.

## Revisión del 12 de octubre de 2026
- Incorpora las correcciones del PR #6 sin reescribir el historial de las ramas.
- CI habilitada para PR dirigidos a `feat/**`, incluidos los PR apilados; conserva push a `main` y los recorridos con API/BD reales.
- `cd web && npm run test:responsive` inicia Vite y Chromium y verifica panel, formularios y desplazamiento de tablas a 320, 360, 768, 1024, 1440, 2560 y 3840 px. Usa respuestas API simuladas, no datos institucionales. Instalar previamente Chromium con `npx playwright install chromium`; para un navegador del sistema se puede indicar `CHROMIUM_EXECUTABLE_PATH`.
- El smoke comprueba nombre institucional largo, Escape/foco, cierre con fondo, restauración de scroll al cambiar a escritorio, campos dentro del viewport, acceso a acciones de tablas y tamaño de texto del 200 % en escritorio. Se ejecuta también en el job web-e2e de CI.
- Validación local: web lint/build, 37 pruebas unitarias y smoke responsive; consistencia de versiones 1.20.0. Backend y mobile mantienen las mismas dependencias y código que la fase 1, ya comprobados localmente.
- Pendiente: CI completa del nuevo SHA, auditoría WCAG AA, zoom de navegador al 200 % y revisión de todos los módulos en dispositivos reales. No se declara certificación de piloto.
