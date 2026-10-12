# Validación UX/UI antes de aprobar el PR

## Cambios incluidos

- Web: Onest vía Google Fonts, navegación responsive, componentes visuales comunes, alta/listado de alumnos, dashboard por rol.
- Móvil: Onest variable empaquetada localmente y cargada con expo-font, fallback del sistema, estilos compartidos para las seis secciones del alumno.
- Contraste: cálculo automático del color del texto para fondos institucionales y pruebas unitarias de ejemplos claros, oscuros e intermedios.

## Verificaciones automáticas obligatorias

- `cd web && npm run lint && npm test && npm run build`
- `cd mobile && npm test && npx tsc --noEmit && npx expo export --platform android --output-dir .expo/export`
- `cd backend && npm run lint && npm run typecheck && npm run build && npm test`
- CI GitHub: integración MySQL, SQL Server y recorridos Chromium con API real.
- **Regresión adaptada:** `backend/test/recorridos-web.ts` usa las etiquetas actuales del formulario: `Plantel *`, `Nombre(s) *`, `Correo institucional *`, botón `Registrar alumno`; edición `Editar expediente` y botón `Guardar cambios`. Los resultados E2E deben comprobarse en CI.

## Matriz manual de experiencia web

- Viewports: 320, 375, 768, 1024 y 1440 px; zoom navegador al 200 % y tamaño de letra aumentado.
- SUPERADMIN, ADMINISTRATIVO, MAESTRO y FINANZAS: menú sin enlaces prohibidos, dashboard pertinente, navegación con teclado.
- Alumnos: alta con CURP correcta/incorrecta, errores de API sin pérdida de datos, actualización de expediente y listado con 0, 1 y varias páginas.
- Docentes, materias, grupos, finanzas, calificaciones, operaciones, configuración y cuenta: tablas desplazables sin desbordamiento del documento, formularios sin controles cortados, estados vacíos/errores/cargas y foco visible.
- Probar temas personalizados con primario claro/oscuro, acento claro/oscuro y tonos intermedios; contraste WCAG AA 4.5:1 para texto regular y 3:1 para controles e indicadores.
- Verificar enlaces de salto, navegación con Tab / Shift+Tab / Escape y lectores de pantalla NVDA o VoiceOver.
- Comprobar que no se exponen datos de menores o calificaciones fuera de rol.

## Matriz manual de experiencia móvil real

- Dispositivos físicos Android e iOS con tamaños pequeños y grandes, tamaño de letra del sistema elevado y lector de pantalla TalkBack / VoiceOver.
- Inicio sin red: fuente Onest incluida en el paquete; comprobación de carga, fallback y persistencia de sesión.
- Login del ALUMNO con email y contraseña temporal, cambio obligatorio, error de red y reintento.
- Inicio, Materias, Tareas, Calificaciones, Estado de cuenta y Perfil: sin contenido cortado, interacción a una mano y objetivos táctiles >= 44 dp.
- Materiales, entregas, pagos, cambio de contraseña y notificaciones: confirmar doble toque, estado ocupado, error y éxito.
- Verificar tema personalizado y contraste de cabecera, botones, navegación y tarjetas.

## Criterio de aprobación

La revisión de código y los tests automáticos no sustituyen la ejecución en dispositivos físicos.
Mantener el PR como borrador si faltan resultados de CI, evidencia de contraste completo o comprobaciones en dispositivos.

## Evidencia de esta revisión

- Pruebas unitarias web y móvil ejecutadas; compilación web y exportación Android verificadas mediante CI.
- Chromium con API simulada: SUPERADMIN, ADMINISTRATIVO, FINANZAS y MAESTRO; temas claros, oscuros e intermedios; contraste del menú y estado activo.
- Formulario/listado de alumnos a 320, 375, 768, 1024 y 1440 px, y renderizado con zoom al 200 %: validación de CURP y ausencia de desbordamiento del documento.
- Correcciones: contraste específico del fondo activo, texto del botón móvil, fallback de fuente en navegación nativa y altura de pestañas compatible con el área segura.
- Sin ejecución en dispositivos físicos, TalkBack o VoiceOver. La comprobación de temas institucionales reales y de todas las pantallas sigue pendiente; esta evidencia no certifica accesibilidad completa.
