# Modernización UX 1.22.0 — Fase 4

## Implementado
- Skeleton responsive accesible para rutas web lazy.
- Animación desactivada con prefers-reduced-motion.
- Geometrías flexibles sin ocultar el estado a lectores de pantalla.

## Pendiente de implementación
- Caché de datos compartida, coalescencia de solicitudes y su invalidación segura.
- Antes de habilitar caché: aislar por usuario, sesión, plantel, ciclo, rol y parámetros; invalidar al cerrar sesión, mutar o cambiar de contexto.
- Estado de carga de datos específico por tabla, no solo por ruta.

## Verificaciones requeridas
- Lint, compilación, tests y captura en móvil/escritorio.
- Comprobar transiciones lentas con herramientas de red y lectores de pantalla.

Sin cambios de contratos, esquema ni permisos. Revertible sin migración.

## Revisión del 12 de octubre de 2026
- Incorpora las correcciones del PR #8 y conserva Axios 1.20.0 en los tres lockfiles.
- Reutiliza la utilidad compartida para texto de lector de pantalla y mantiene las geometrías del skeleton como decorativas, sin controles enfocables.
- En alto contraste usa bordes y colores del sistema, sin animación; mantiene la preferencia de movimiento reducido.
- Local: web lint/build y 43 pruebas unitarias. Smoke de ruta lazy retrasada a 320 y 1440 px, movimiento reducido y colores forzados a 360 px; verifica que el estado desaparece al terminar la carga.
- Se conservan las pruebas responsive de panel, alumnos y Analítica a 320–3840 px y la verificación de versiones 1.22.0.
- La CI del SHA publicado debe comprobarse. La prueba del árbol accesible no sustituye la revisión con lectores de pantalla y dispositivos reales. La caché global y los skeletons específicos de consultas siguen pendientes de otra entrega.
