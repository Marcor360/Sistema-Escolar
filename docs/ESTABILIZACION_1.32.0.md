# Estabilización y seguimiento — candidata 1.32.0

Fecha: 29/oct/2026 (America/Mexico_City). Cambios locales sobre la candidata 1.31.1, conservando la cartera integral 1.31.0. Este documento describe código y verificaciones locales; no acredita ejecución de GitHub Actions de un nuevo SHA, publicación ni aceptación institucional.

## Cambios

| Área | Resultado | Archivos principales |
| --- | --- | --- |
| Dependencias | Vite pasa de 6.4.4 a 6.4.5 dentro de la misma rama mayor. Se actualizan declaración y lockfile. | `web/package.json`, `web/package-lock.json` |
| CI | El job `web-e2e`, después de instalar Chromium, ejecuta `npm run test:cartera`. Comprueba creación sin correo, cuotas, pausa, detalle, cancelación/reanudación y correo posterior en cuatro anchos. Son pruebas con API simulada; la integración de servidor continúa en los jobs de ambos motores. | `.github/workflows/ci.yml`, `web/test/cartera-integral.cjs` |
| Detalle de cartera | Ruta `/apertura-cartera/:id`, protegida por la misma capacidad administrativa. El listado muestra número de cuotas, total y enlace. Volver conserva búsqueda, página y filtros. El detalle tiene carga, error/reintento, título enfocado, calendario/pagos y confirmación explícita antes de reanudar. Cancelar devuelve el foco. | `web/src/pages/DetalleApertura.tsx`, `AperturaCartera.tsx`, `App.tsx` |
| Componentes | Calendarios y previsualizaciones de apertura y reinscripción separados. Tipos de reinscripción en su propio archivo. Las páginas conservan estado, claves de cotización/idempotencia y solicitudes. Se corrigen claves repetidas de React al mostrar varias cuotas de un mismo concepto en la cotización de reinscripción. | `web/src/features/cartera/` |
| Dominio | Validación de cuotas y lectura del resultado académico del origen separadas. El servicio mantiene autorización, orden de bloqueos, cotización/hash y transacciones. Se conservan importes en centavos, becas, pagos y restricciones de fechas. | `backend/src/cartera/cuotas-reinscripcion.ts`, `evaluacion-reinscripcion.ts`, `reinscripcion-periodo.service.ts` |
| Estilos | Tablas de escritorio y fichas móviles centralizadas en `styles/tablas.css`, cargadas desde `main.tsx`; se retiran importaciones por página del antiguo `tabla-adaptable.css`. Botones y tamaño compacto reunidos en `controles-modernizados.css`, con mínimo de 44 px. Se eliminan declaraciones antiguas sobreescritas de campos; ambos calendarios comparten rejilla. | `web/src/styles.css`, `web/src/styles/`, `web/src/main.tsx` |
| Seguimiento | Selector de plantel para personal autorizado. Nuevas categorías administrativas: alumnos sin correo institucional, alumnos con correo y activación pendiente, carteras en pausa. Los enlaces conservan el plantel y abren el listado filtrado. Las respuestas antiguas no pueden reemplazar la consulta del plantel nuevo. | `CentroPendientes.tsx`, `seguimiento.service.ts`, `Usuarios.tsx`, `usuarios.service.ts`, `cartera.service.ts` |

## Reglas de los nuevos pendientes

- ADMINISTRATIVO ve únicamente sus planteles; SUPERADMIN puede consultar todos o elegir uno. Se valida `plantelId` en servidor. FINANZAS conserva sus categorías financieras y puede filtrarlas, sin recibir las nuevas categorías administrativas. MAESTRO y ALUMNO no reciben un selector administrativo ni pueden añadir un plantel para consultar pendientes ajenos.
- Los nuevos pendientes cuentan expedientes ACTIVO con usuario activo. TypeORM excluye registros eliminados lógicamente en las relaciones. Sin correo significa `email IS NULL`; activación pendiente exige correo no nulo y bandera pendiente, de modo que las categorías no se solapan.
- El filtro de Usuarios `sinCorreo=true` muestra los expedientes activos pendientes de asignación. `activacionPendiente=true` muestra alumnos activos con correo que aún deben activar la cuenta; exige capacidad administrativa. La respuesta administrativa incluye la bandera de activación. El estado es visible y explica cómo solicitar el código; no se ofrece restablecimiento a un administrativo mientras la activación está pendiente. SUPERADMIN conserva su operación existente.
- Las carteras en pausa se cuentan por el plantel de la apertura y el listado usa `estado=PAUSA`. Una apertura que cambia de estado deja de aparecer en esa consulta.
- Seguimiento solo consulta: no asigna correos, envía códigos, reanuda carteras ni genera cargos. Esas operaciones siguen en sus módulos con sus permisos y confirmaciones.

## Contratos compatibles

- `GET /api/seguimiento/pendientes?plantelId=ID`: parámetro opcional, entero positivo, validado por alcance. Sin parámetro se conserva la consulta por capacidades de la cuenta.
- `GET /api/usuarios/listado?tipo=ALUMNO&activacionPendiente=true&plantelId=ID`: filtro administrativo opcional. El frontend utiliza `plantel` en la URL de Usuarios y lo traduce a `plantelId` para API.
- `GET /api/cartera?estado=PAUSA&plantelId=ID`: filtro opcional validado (`PAUSA`, `PENDIENTE`, `ABIERTA`). Búsqueda y paginación conservan los filtros.
- No se añade esquema ni migración para 1.32.0. El despliegue conjunto sigue requiriendo las migraciones incrementales de cartera integral 1.31.0; no ejecutar `schema.sql` completo.

## Verificación local

Datos ficticios, bases Docker desechables y proveedores de correo simulados/deshabilitados. No se operaron datos institucionales ni cobros reales.

| Comprobación | Resultado local |
| --- | --- |
| Backend: lint, typecheck, compilación | Aprobados |
| Backend: pruebas unitarias | 100 suites / 571 pruebas aprobadas |
| Web: lint y compilación | Aprobados con Vite 6.4.5 y `VITE_API_URL=https://api.example.invalid/api` |
| Web: pruebas | 71 archivos / 265 pruebas aprobadas. Tras ajustar los tipos de las nuevas pruebas se repitieron los tres archivos afectados: 7 pruebas aprobadas |
| Móvil | TypeScript sin errores; en esta candidata solo se actualiza el metadato de versión |
| Dependencias | `npm audit --json`: cero vulnerabilidades reportadas en backend, web y móvil; no equivale a auditoría integral de seguridad |
| Cartera en navegador | Recorrido con API simulada aprobado en 360/768/1280/1920 px: detalle separado, volver al listado, cuotas visibles, cancelación sin escritura, foco restaurado, reanudación que permanece en pausa, alta sin correo y asignación posterior |
| Accesibilidad del recorrido de cartera | Sin infracciones reportadas por las reglas axe WCAG 2 A/AA y 2.1 AA ejecutadas en detalle y formulario. Reflujo y ampliación CSS al 200%; no certificación de lector de pantalla o zoom nativo |
| Regresión general web | `test:responsive` aprobado: formularios, tablas, módulos, recorridos, ampliación y recuperación/activación con API simulada |
| Integración seleccionada | Nueve casos aprobados en MySQL 8.4 y nueve en SQL Server 2022, con 122 casos omitidos por el filtro en cada ejecución |
| Integración completa MySQL | 130 casos aprobados y un fallo por colisión del prefijo ficticio `PS` con la prueba de importación persistente. Se corrigió el aislamiento con un prefijo único por ejecución; la repetición conjunta de ambos casos pasó (2 aprobados / 129 omitidos). No se presenta como una ejecución única de 131 aprobados |
| Integración completa SQL Server | Interrumpida durante el cambio de entorno, sin resultado final disponible. No se acredita la suite completa. Los nueve casos seleccionados habían pasado; la repetición conjunta de importación persistente y pendientes tras corregir el prefijo también pasó (2 aprobados / 129 omitidos) |
| Consistencia | Versiones 1.32.0 y migraciones espejo coherentes; 336 consultas de cliente contrastadas con 330 rutas API; `git diff --check` sin errores |

Las correcciones iniciales de pruebas se limitaron a simular correctamente la consulta de grupos/API modal, esperar la resolución de cancelación, omitir la guía antes de operar en navegador y ajustar los tipos al objetivo TypeScript vigente. Las filas aprobadas corresponden a las ejecuciones posteriores; la tabla distingue expresamente las limitaciones de las ejecuciones completas.

## Límites

No incluye reprogramación de cuotas en pausa ni ficha unificada del alumno; siguen siendo desarrollos posteriores. Los conteos no prueban entrega de correo al buzón. Las pruebas automáticas de accesibilidad no sustituyen lectores de pantalla o dispositivos físicos. Permanecen pendientes 61 escenarios UAT y 8 requisitos institucionales de salida, sin modificar sus aceptaciones.
