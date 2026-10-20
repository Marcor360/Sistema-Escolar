# Remediación base de UX y accesibilidad 1.27.5

Mejoras detectables por revisión del código, **no certificadas aún mediante UAT institucional**:
- SelectorBuscable: entrada de tipo búsqueda, instrucciones relacionadas con aria-describedby, reintento manual visible en error y conservación de la elección.
- Navegación: enlace de salto al formulario para rutas de edición enfocada; refuerzo del foco de teclado en controles y menú oscuro.
- Responsive: layouts de formularios/paneles por debajo de 700 px, mínimos flexibles, paginación adaptable y KPI apilados en 360 px.

## Pruebas obligatorias
1. Teclado sin ratón en login, menú y formularios de alumnos/cartera/calificaciones; Tab/Escape/Shift+Tab y salto de contenido.
2. Zoom web 200/400%, anchos 320/360/768/1280, texto aumentado y navegación por lector de pantalla.
3. Falla de red al buscar: conservar valor y permitir reintento. Buscar 11+ resultados y comprobar página.
4. Pruebas React Testing Library, lint, build, revisión de contraste WCAG 2.2 AA en equipos/dispositivos reales.
5. Revisión Expo alumno por lector de pantalla y áreas táctiles >=44px sin introducir gestión administrativa.

Esta entrega no inventa resultados de UAT; registrar hallazgos restantes en #141.
