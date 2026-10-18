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
