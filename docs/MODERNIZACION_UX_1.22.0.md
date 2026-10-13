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
