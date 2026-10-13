# Modernización UX 1.21.0 — Fase 3

## Alcance implementado
- Panel de filtros y estado inicial explicativo para Analítica.
- Indicadores financieros presentados como cuadrícula adaptable.
- Tabla académica protegida de desbordamiento horizontal.
- Se conservan los permisos y filtros del backend.

## Pendiente
- Auditoría de los demás dashboards por rol.
- Lint, compilación, pruebas y revisión visual en los breakpoints definidos.
- Ensayos con roles administrativos, maestro y finanzas, inclusive combinaciones de roles.

No hay cambios de esquema ni API; revertible mediante revert del PR.

## Validación y correcciones del 12 de octubre de 2026
- Incorpora main y las correcciones ya fusionadas de navegación responsive y CI.
- Cada métrica financiera conserva etiqueta y valor en una misma celda; la tabla académica tiene región etiquetada y foco para desplazarse con teclado.
- Axios conserva su versión real 1.20.0 en los tres lockfiles. El script de consistencia comprueba versiones de dependencias frente a los tarballs npm para impedir sustituciones accidentales al versionar la aplicación.
- Local: web lint/build y 42 pruebas; backend lint/typecheck y 188 pruebas; mobile TypeScript; consistencia 1.21.0.
- Smoke Chromium con API simulada: panel, alumnos y Analítica a 320, 360, 768, 1024, 1440, 2560 y 3840 px; tabla académica desplazable con teclado, métricas agrupadas y texto del 200 % en escritorio.
- Pruebas de presentación: respuestas académicas, financieras y mixtas, filtros, ausencia de clases y reintento tras error. Los permisos reales siguen verificándose en backend y CI.
- La CI del nuevo SHA y la revisión integral con lectores de pantalla/dispositivos reales deben comprobarse antes de certificar un piloto. La modernización de otros dashboards sigue fuera del alcance de este PR.
