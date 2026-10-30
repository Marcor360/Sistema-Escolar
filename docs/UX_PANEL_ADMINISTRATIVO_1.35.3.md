# Optimización del centro administrativo · 1.35.3

## Flujo de trabajo
- Un solo filtro de plantel controla indicadores, centro de pendientes y próximos eventos del dashboard.
- El centro solo destaca categorías con pendientes; las categorías en cero siguen consultables mediante un desplegable, evitando un panel de tarjetas vacías.
- Los expedientes de alumnos conservan historial y boleta como acción primaria y agrupan transferencias, bajas, ediciones y eliminación definitiva bajo «Más acciones». Los permisos existentes siguen vigentes.
- Asignación de funciones utiliza tabla adaptable y despliega la lista de planteles en lugar de concatenarlos. No se modifican jerarquías ni asignaciones API.

## Verificaciones exigidas
`cd web && npm run lint && npm run test && npm run build`; pruebas con roles SUPERADMIN, ADMINISTRATIVO, FINANZAS, DIRECTOR; pantallas de 320, 360, 768 y 1440 px; cambios de plantel durante solicitudes pendientes; navegación por teclado y confirmaciones destructivas.

## Contrato
Sin tablas, endpoints ni dependencias nuevas. El API existente mantiene autorización. PR apilado sobre 1.35.2; cambios de GitHub no implican despliegue a staging.
