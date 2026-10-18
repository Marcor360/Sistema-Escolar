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


## Entrega funcional de #123 (18/10/2026)
- Panel inicial sin montar ni consultar la página del módulo; acciones filtradas por rol y código diferido por ruta.
- Alumnos, Materias/Ciclos, Usuarios, Planteles y Grupos: alta/edición separadas del directorio mediante `vista` e `id` en URL; navegación y cabecera lateral ocultas durante el formulario. Se conservan filtros/página al volver y se valida permiso antes de cargar una edición directa.
- Finanzas: cargos, pagos, adeudos, conciliación y conceptos se montan por separado. Alta individual de cargo/pago y generación de colegiaturas usan formulario enfocado; idempotencia y confirmación de operaciones masivas conservadas.
- Nuevas consultas `/planteles/listado` y `/academico/ciclos/listado` con diez registros, límites, búsqueda literal y orden estable en servidor; los endpoints de arreglos para selectores siguen disponibles. Detalles por ID para enlazar ediciones sin descargar el directorio.
- Los módulos secundarios entran por su acción real. Avisos tiene redacción enfocada y bloqueo mientras se envía. Panel, Cuenta y Configuración siguen como vistas singulares.
- Confirmación al cancelar o usar Atrás con cambios; bloqueo durante solicitudes; foco al cambiar de operación; datos conservados tras error. Los recorridos reales entran por las tarjetas antes de registrar/consultar.

### Continuidad de #105
Esta entrega no cierra toda #105: quedan la separación interna de formularios secundarios (biblioteca, calendario, conducta, operaciones y edición/captura académica), la revisión de colecciones propias de Expo y la UAT institucional. No se cambian las reglas de evaluación de #102 ni se acredita staging o despliegue.
