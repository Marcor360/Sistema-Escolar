# UX global de módulos — entrega incremental

## Estado
`web/src/components/PanelAccionesModulo.tsx` y el PR #112 ya introducen el patrón inicial en Docentes. `web/src/pages/Alumnos.tsx` y `web/src/pages/Finanzas.tsx` todavía concentran listado, acciones y formularios, con riesgo de sobrecarga visual.

## Diseño objetivo por módulo
- Alumnos: panel → Registrar / Consultar / Expediente-Editar / Dar de baja o transferir según rol; conservar alta por FINANZAS y edición por ADMINISTRATIVO (SUPERADMIN transversal).
- Finanzas: panel → Cargos / Pagos / Adeudos / Conciliación / Catálogos con permisos efectivos; operaciones financieras confirmadas e idempotentes.
- Usuarios, Planteles, Materias, Grupos: mismo patrón, sin mostrar Eliminar si no existe operación autorizada.
- Calificaciones, avisos, biblioteca, calendario, analítica: adaptar **solo** acciones reales, no crear tarjetas artificiales para configuración singular.

## Implementación por archivos
`web/src/pages/` (una sección por PR posterior), `web/src/layout/Shell.tsx`, componente de panel existente, `web/test/responsive.cjs` y pruebas RTL/E2E.
Las pantallas de formulario deben navegar sin distractores, cancelar con confirmación si hay cambios y restaurar búsqueda/filtros/página al volver. No borrar estado previo al error.

## Aceptación
Entrada inicial sin descargar directorios; listados 10 por página **reales**, buscador remota, foco accesible, texto 200 %, viewport móvil/escritorio y pruebas que **entran en Consultar** antes de pedir un registro. Mantener lazy loading por rutas y guards API intactos.

## Dependencia
Consolidar #112 antes de refactorizar módulos adyacentes; evitar conflictos de edición simultánea en las mismas pantallas. Ref. #105.
