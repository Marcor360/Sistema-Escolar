---
name: iua-auditoria-ux-accesibilidad
description: Revisar experiencia UX, responsive, teclado y accesibilidad del portal React/Vite y recorridos guiados por rol de IUA.
---
# Auditoría UX/UI del portal

## Fuentes
Leer `web/src`, `docs/ACCESIBILIDAD_UX_1.27.5.md`, `docs/VALIDACION_UX_ONEST.md`, `docs/MATRIZ_ACCESO.md` y `web/test/responsive.cjs`.

## Inspección reproducible
1. Auditar menús, Shell, tableros, listados largos, tablas, importaciones, formularios, modales, perfiles y tutorial por rol.
2. Probar ancho 360, 768, 1280 y 1920 px; 200% de zoom; navegación tab/shift-tab/escape; foco al cerrar diálogos; lector de pantalla cuando esté disponible.
3. Verificar contraste WCAG 2.2 AA, etiquetas accesibles, mensajes de error asociados, estados de carga/vacío/error, objetivos táctiles, reflow sin scroll horizontal global y menús hamburguesa consistentes.
4. Confirmar que la guía inicial permita omitir y repetir recorrido desde Configuración y no revele pantallas a roles no autorizados.
5. Ejecutar `cd web && npm run test`, `npm run test:responsive` (requiere Playwright + navegador instalado), `npm run lint` y `npm run build` en ambiente local aislado. Si axe-core o Lighthouse están disponibles, registrar herramientas/versiones; no fingir que se ejecutaron.
6. Distinguir un defecto visual de una autorización rota: los permisos efectivos viven en API.

## Resultado
Agrupar hallazgos por ruta, viewport, severidad, pasos de reproducción, evidencia y recomendación concreta. No rediseñar sin respetar marca configurable vía `GET /api/configuracion/marca`.
