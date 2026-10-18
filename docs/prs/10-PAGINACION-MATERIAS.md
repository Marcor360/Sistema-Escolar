# Paginación/búsqueda académica sin romper selectores

## Evidencia
`backend/src/academico/materias.service.ts:13` devuelve todas las materias activas. `web/src/pages/Materias.tsx:21` consume un arreglo, y otros formularios pueden requerir un catálogo completo pequeño. Cambiar la respuesta in situ sin adaptar todos los consumidores rompería funcionalidades vigentes.

## Contrato de consulta
1. Inventariar consumidores de `GET /api/academico/materias` (web, reportes, importaciones, móvil si aplica).
2. Introducir una **variante versionada de listado paginado** o una ruta explícita que no rompa el contrato de arreglo existente hasta migrar todos los consumidores. El endpoint concreto se definirá al implementar tras revisar rutas actuales.
3. Reusar `PaginacionDto` (10 por defecto, máximo 100), normalizar `buscar` (clave/nombre), filtrar activos y permisos, orden estable con desempate por ID.
4. Limitar resultados, contar correctamente sin N+1, consultas parametrizadas y alcance por plantel donde aplique.
5. En web, mostrar buscador paginado y selector remoto cuando el volumen requiera ello; restaurar filtros/página y conservar exportaciones separadas.

## Aceptación
Pruebas de 115 materias y búsquedas de claves fuera de primera página; filtros tras cambio de programa, respuesta compatible con consumidores existentes; tests SQL MySQL/SQL Server y accesibilidad.

## Estado
Plan de migración de contrato. No se cambia la respuesta pública hasta tener pruebas y consumidores adaptados.

## Implementación
`GET /api/academico/materias/listado` añade el contrato `{datos,total,pagina,porPagina}` con diez resultados por defecto y máximo cien. Filtra activo, busca literalmente por clave/nombre mediante parámetros (escapa %, _ y [), ordena por clave e ID y conserva los roles del catálogo existente. Materia es un catálogo global, sin vínculo directo a plantel o programa: no se inventa ese filtro. La autorización de asignación por plantel permanece en los módulos de grupos/clases.

La página Materias consume la nueva ruta, mantiene búsqueda/página en la URL, reinicia a página uno al buscar, muestra carga/error/vacío y descarta respuestas anteriores. Grupos y ProgramasEspeciales conservan por compatibilidad su consumo de `GET /academico/materias` como arreglo; reportes/importaciones y móvil no requieren cambiar ese contrato. No se modifican exportaciones ni datos existentes. La migración de selectores grandes puede usar la nueva ruta sin cambiar el arreglo público.

Pruebas RTL de consulta/búsqueda/navegación y contratos existentes; integración en ambos motores con 115 materias, página 12, clave fuera de primera página, comodines literales, validación de límites y acceso denegado a ALUMNO. No requiere migraciones.
