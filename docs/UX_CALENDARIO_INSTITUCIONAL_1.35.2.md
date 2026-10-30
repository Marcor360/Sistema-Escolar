# Calendario institucional y consulta consolidada · 1.35.2

## Resultado
- La web administrativa abre el calendario directamente, sin pantalla de selección previa.
- La vista mensual es la inicial y usa el mes actual del ciclo o, fuera de él, su primer mes.
- **CONSOLIDADO** reúne eventos institucionales y de planteles/grupos autorizados; **GLOBAL** consulta únicamente eventos sin plantel ni grupo.
- El filtro `ambito` se valida en el DTO NestJS en `GET /api/calendario` y `GET /api/calendario/listado`. Siguen vigentes autorización por rol, plantel, nivel, grupo y audiencia.
- Publicación, importación y marcadores se agrupan en un panel expandible de gestión; las fechas no generan cargos, asistencia ni calificaciones.
- Se conserva la vista anual imprimible y la leyenda.

## Verificaciones y UAT
Ejecutar backend lint, typecheck, test, build; web lint, test, build; scripts de consistencia/versionado. Verificar presencialmente SUPERADMIN, personal por plantel, MAESTRO y ALUMNO, fechas globales, niveles, grupos, ciclos que cruzan año, edición optimista y bloqueo de audiencias internas.

## Alcance
Sin nuevas dependencias ni migraciones. Este PR depende del PR del portal Expo Web versión 1.35.1. No publica en IIS ni instala aplicaciones.
