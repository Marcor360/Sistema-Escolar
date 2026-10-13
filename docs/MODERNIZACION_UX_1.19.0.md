# Modernización UX/UI — PR 1 / 5 (1.19.0)

## Alcance implementado
- Navegación móvil: capa de cierre y bloqueo de scroll al abrir el menú.
- Layout: contenedor flexible para escritorio y pantallas de alta resolución.
- Marca: nombres institucionales largos con ajuste de palabra.
- Versiones sincronizadas entre backend, web, móvil y Expo. No se cambian funciones ni permisos de la app móvil.

## Plan de los siguientes PR
1. **1.19.0**: estructura responsive y navegación (este PR).
2. **1.20.0**: sistema visual, formularios y tablas.
3. **1.21.0**: paneles y experiencia por rol.
4. **1.22.0**: skeletons, caché con aislamiento por sesión y gestión de errores.
5. **1.23.0**: Tabler Icons, accesibilidad y pruebas responsive.

## Validaciones pendientes
- CI: lint, typecheck, build y tests de los workspaces.
- Pruebas visuales a 320, 360, 768, 1024, 1440, 2560 y 3840 px.
- Revisión de foco, navegación por teclado, Escape, scroll y zoom 200%.
- Contraste AA con marca institucional personalizable.

## Riesgos y reversión
Los cambios visuales pueden alterar geometrías de ciertos módulos. No hay migraciones ni cambios de contrato API. Revertir este PR devuelve los estilos y comportamiento anteriores. No declarar piloto listo hasta validar en servidor y dispositivos.

## Revisión del 12 de octubre de 2026
- Menú desplegable fuera del flujo del contenido, con desplazamiento conjunto de navegación y acciones de cuenta para nombres institucionales largos.
- Al pasar de móvil a escritorio se cierra el menú y se restaura el scroll previo; también se restaura al navegar, pulsar Escape, cerrar con el fondo o desmontar el shell.
- Regresiones unitarias de cierre, foco, navegación, cambio de breakpoint y limpieza del scroll.
- Validación local: backend lint/typecheck y 188 pruebas; web lint, build y 37 pruebas; mobile TypeScript; consistencia de versiones 1.19.0.
- Chromium con respuestas API simuladas: panel a 320, 360, 768, 1024, 1440, 2560 y 3840 px sin overflow horizontal; Escape, fondo y cambio móvil/escritorio comprobados. Esta revisión visual no sustituye los recorridos con API/BD reales ni una auditoría WCAG completa.
