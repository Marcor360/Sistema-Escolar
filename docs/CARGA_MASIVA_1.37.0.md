# Carga académica masiva y preparación de grupos · 1.37.0

Implementación local sobre 1.36.0 (`2870152`), pendiente de publicación.

## Importar materias y grupos

En **Importar y promover → Importar expedientes**, selecciona MATERIAS o GRUPOS. También hay accesos desde Consultar materias, Grupos y la guía de preparación académica.

1. Descarga la plantilla del tipo correcto.
2. Completa hasta 500 filas en CSV o XLSX, máximo 5 MB, sin fórmulas.
3. Previsualiza y revisa las filas válidas, duplicadas y con errores.
4. Corrige todos los errores antes de confirmar. Los duplicados se omiten sin actualizar ni reactivar registros existentes.
5. Confirma. Se vuelven a validar planteles, ciclo, contexto y duplicados dentro de una transacción. Un error revierte la carga completa. La previsualización pertenece al actor, está cifrada, vence en 15 minutos y se consume al confirmar.

MATERIAS admite clave, nombre, créditos, tipo y descripción. Es un catálogo compartido, con la misma autorización administrativa del alta individual. Los vínculos a planes y periodos se completan después.

GRUPOS admite plantelId, cicloId, nombre, grado, turno y contexto opcional (nivelId, carreraId y periodoAcademicoId juntos). Requiere plantel activo autorizado y ciclo ACTIVO o PREPARACION. No crea docentes, materias asignadas, inscripciones ni cargos. Solo Administrativo y Superadmin pueden importar ambos tipos; Finanzas conserva su importación de alumnos.

No hay cambios de esquema: los tipos nuevos caben en la columna varchar existente de previsualizaciones. Se conservan los índices únicos de materias y grupos. La bitácora se guarda en la misma transacción.

## Preparación por grupo

`GET /api/academico/grupos/preparacion` aplica los filtros y el alcance de planteles de la consulta existente, y agrega por página:

- Materias asignadas.
- Asignaciones sin docente activo (incluye cuenta docente inactiva).
- Inscripciones ACTIVA del grupo.
- Materias activas vinculadas al periodo y cuántas no están asignadas al grupo.

Las materias del periodo son una lista por revisar, no una nueva regla de obligatoriedad. Sin periodo vinculado, los valores esperadas/pendientes son null; la UI pide revisar el plan. Un periodo sin materias vinculadas también se identifica expresamente. No se declara completo un grupo por ausencia de información.

Los agregados utilizan tres consultas para todos los IDs de la página autorizada, en vez de descargar materias y alumnos de cada grupo. La respuesta no incluye datos personales de alumnos. El endpoint solo permite Administrativo/Superadmin.

## Medición y optimización

`web/test/medir-carga-grupos.cjs` abre la consulta cinco veces con un grupo, un catálogo simulado de 1000 materias y 40 ms por respuesta. Registra peticiones, bytes y mediana hasta mostrar el listado. La API está simulada: no mide la latencia SQL o la red institucional.

El listado deja de pedir el catálogo completo de materias. Ese catálogo se carga al administrar un grupo, con indicador de carga, reintento y bloqueo de asignaciones si falla. Las creaciones y consultas normales tampoco descargan alumnos o asignaciones de todos los grupos.

En la primera comparación, el volumen bajó de 148064 a 716 bytes y las peticiones de 8 a 6. El modo desarrollo usa StrictMode y duplica los efectos iniciales: equivalen a 4 frente a 3 rutas de datos por montaje. La reducción de bytes corresponde a este escenario, no a una promesa de rendimiento de producción. Las primeras mediciones de tiempo coincidieron con compilaciones y contenedores de pruebas; no se interpretan como mejora de latencia.

En una repetición secuencial sin esas cargas, la mediana fue 879 ms antes y 920 ms después (cinco muestras por versión). No hay evidencia de una mejora de tiempo en este ensayo: la ventaja confirmada es la reducción de peticiones y bytes, mientras la respuesta incorpora ahora los indicadores. La latencia del servidor y de la base institucional debe medirse en el entorno de pruebas antes de atribuirle una mejora porcentual.

## Verificación

- Permisos y plantillas: pruebas unitarias backend.
- API y BD reales: casos `carga masiva` del conjunto de integración en bases desechables; no se utiliza staging.
- Casos: duplicados de archivo/BD, actor del preview, confirmación explícita, consumo concurrente, cambio del ciclo entre preview y confirmación, contexto incompleto, plantel ajeno y agregación de preparación.
- UI: tipos nuevos, bloqueo por errores y distinción entre ausencia de contexto y cero pendientes; navegador en 360, 768, 1280 y 1920 px.
- No se envían correos reales ni se crean cargos en estas pruebas. CI por SHA, despliegue y UAT institucional se acreditan por separado.

Validación local completada: lint, TypeScript y compilación de backend/web; TypeScript de móvil; 648 pruebas unitarias backend, 301 web y 149 móvil, más 11 comprobaciones Node de móvil. Los dos casos nuevos de integración aprobaron en MySQL y SQL Server; no se ejecutaron los otros 141 casos de integración. La navegación académica aprobó en los cuatro anchos indicados. Consistencia del proyecto y avance SemVer 1.36.0 → 1.37.0 comprobados. Entrega local, sin push ni despliegue.
