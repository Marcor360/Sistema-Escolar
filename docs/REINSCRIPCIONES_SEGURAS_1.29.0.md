# Inscripción y reinscripción por periodo — candidata 1.29.0

Implementación solicitada expresamente para #152 y #177, sobre main 1.28.0 (#209). No implica despliegue, migraciones institucionales ni aceptación UAT. La normativa de evaluación conserva aprobación explícita de Final; no se activa redondeo pendiente.

## Reglas aplicadas

- Alta ordinaria: exclusivamente Apertura de cartera, con cotización vigente y commit de agrupación/cargos. El POST directo de Grupos nunca crea altas nuevas, aunque se envíe motivo o se desactive la antigua bandera `INSCRIPCION_ORDINARIA_SOLO_CARTERA`.
- La ruta directa solo reactiva una fila existente BAJA del mismo alumno/grupo, con motivo de al menos 10 caracteres y referencia documental de al menos 5; mismos permisos administrativos, cupo y plantel. No genera cargos retroactivos ni elimina notas. Una inscripción HISTORICA no se reactiva ni se convierte en BAJA por esa ruta.
- Grupos manuales seleccionados expresamente por Control Escolar: 1–50 alumnos, sujetos a reservas de recursamiento. Agrupación automática: nuevos grupos desde 5, máximo ordinario 50; remanente de 1–4 hasta 54. Con 55 se divide 50+5; no se redistribuye alumnado con historial. La política mantiene la selección manual ya existente, sin inventar un cupo especial general.
- Reinscripción: usa el expediente existente y el plan/periodos configurados (ANUAL, SEMESTRAL o CUATRIMESTRAL), sin fijar nueve periodos ni deducir modalidad del nombre del nivel. Mismo plantel/nivel/plan/modalidad. Cambio de plantel o plan requiere su trámite específico.
- Se admite mismo ciclo vigente y ciclo posterior con origen CERRADO. Dentro del mismo ciclo, el destino debe tener inicio/fin reales configurados en Catálogos; ambos dentro del ciclo. Ninguna migración inventa esas fechas. Para ciclos posteriores se preserva la ventana del ciclo cuando el periodo histórico aún no tiene fechas específicas.
- Avance ordinario: al siguiente número de periodo, con resultados definitivos aprobatorios y publicados. No se toman propuestas, notas parciales incompletas ni faltas como reprobación. Retroceso, repetición y salto necesitan motivo y referencia documental. Si hay materias pendientes o falta configuración/evidencia, Control Escolar debe autorizar expresamente CONDICIONAL y documentarlo. No se alteran notas ni se aprueban materias automáticamente.
- No se reutiliza un grupo donde el alumno ya tiene inscripción histórica: una repetición necesita otro grupo del mismo periodo para no mezclar intentos/calificaciones. Tampoco se duplica una materia recursada activa dentro del grupo destino.

## Precio y autorización

FINANZAS o SUPERADMIN autoriza una cotización persistida con total del periodo, ajustes, becas/descuentos y calendario. ADMINISTRATIVO o SUPERADMIN confirma la parte académica. Los roles pueden combinarse según la matriz vigente; una cuenta exclusivamente FINANZAS no confirma inscripciones y una exclusivamente administrativa no autoriza precios.

La tarifa de catálogo es propuesta: Finanzas debe confirmar el total contractual del periodo. No se multiplica una tarifa mensual ni se inventa el costo anual/semestral/cuatrimestral. Las cuotas suman exactamente la tarifa total, nunca se cobra simultáneamente ese total y sus parcialidades. Un descuento se aplica una sola vez por cuota. Fechas y meses deben estar dentro de la ventana del periodo; no hay dos cuotas del mismo concepto/mes. Trámites y recursamientos se gestionan por sus rutas específicas, no como conceptos libres de esta operación.

La autorización vence a las 24 horas si no se confirma. Se revisan responsable financiero activo, roles/scope, origen, notas publicadas, catálogo y calendario antes de consumirla. Cambio de contexto exige nueva cotización/autorización. Confirmar envía solo ID de autorización, hash, UUID estable y confirmación expresa; no admite sustituir precios desde el cliente.

## Transacción e historial

- `autorizaciones_reinscripcion` y `reinscripciones_periodo` son tablas nuevas. Las aperturas y solicitudes anteriores, sus unicidades y sus conceptos congelados permanecen intactos.
- Clave idempotente única y origen reservado impiden dos reinscripciones desde la misma inscripción. Una autorización solo corresponde a una operación. La misma petición/actor devuelve el recibo actualizado; reutilizar la clave para otra autorización se rechaza.
- Una cohorte comparte alumnos nuevos y reinscritos. El quinto puede llegar por cualquiera de ambos flujos; se asignan grupo y cargos de las dos tablas dentro del mismo commit.
- Sin grupo/cohorte mínima: PENDIENTE, sin cargos ni cambio de inscripción anterior. Al asignar, se generan únicamente cargos del calendario autorizado, el origen pasa a HISTORICA y se crea una inscripción ACTIVA distinta, dentro del mismo commit. Fallo de cargo revierte todo el lote.
- Si el origen, plantel, notas o calendario cambian antes de asignar, la solicitud pasa a REQUIERE_REVISION, sin generar cargos. Se puede anular una solicitud pendiente/en revisión con motivo, conservando registro y origen. Una operación confirmada no se borra ni se revierte anulando cargos/inscripciones implícitamente.
- Cargos previos del mismo concepto/mes o colegiatura del mismo mes requieren conciliación; no se duplican ni se modifican pagos previos. No se bloquean documentos por adeudos. Confirmar no registra un pago.
- Recursamientos conservan participación/intento y acceso mientras sigan activos y el alumno/plantel/clase estén vigentes. La inscripción principal histórica no equivale a BAJA.
- Lista actual de grupo y materias actuales excluyen HISTORICA. Captura oficial, actas, boletas e historial permiten consultar y completar evaluaciones anteriores con permisos y cierres existentes. Cierre de ciclo también considera esos periodos, evitando ocultar pendientes tras el avance.

## Contrato API

- GET `/cartera/reinscripciones/alumnos/:alumnoId`: trayectoria vigente por ID resuelto desde buscador de matrícula/nombre completo. Datos académicos detallados solo para Control Escolar/SUPERADMIN.
- POST `/cartera/reinscripciones/previsualizar`: contexto, origen, conceptos, mes/vencimiento y, opcionalmente, ajustes, parcialidades, condición, motivo y referencia documental.
- POST `/cartera/reinscripciones/autorizar-precio`: FINANZAS/SUPERADMIN; misma petición más cotización.
- GET `/cartera/reinscripciones/autorizaciones/:alumnoId`: autorizaciones vigentes, ámbito del plantel.
- POST `/cartera/reinscripciones/confirmar`: ADMINISTRATIVO/SUPERADMIN; autorización, cotización, idempotencia y confirmado=true. Sustituye la confirmación anterior que solo admitía otro ciclo; actualizar API/web juntas.
- GET `/cartera/reinscripciones/historial` y `/operaciones/:id`: recibos/historial paginados por alcance.
- POST `/cartera/reinscripciones/operaciones/:id/anular`: motivo y confirmado=true, solo pendientes/en revisión.
- GET `/academico/grupos/:id/alumnos?incluirHistoricas=true`: consulta autorizada para captura oficial; por defecto continúa mostrando solo alumnado actual.

## Migración y entrega

`migracion_reinscripciones_periodo.sql`, espejo MySQL/SQL Server, agrega fechas nullable de periodo y las dos tablas. Sin backfill, sin cambios de calificaciones/pagos y sin reemplazar unicidades anteriores. `schema.sql` es referencia documental, no instalador. Ejecutar runner con DB_SYNC=false, SQL/uploads respaldados y restore ensayado antes de una liberación institucional coordinada. Volver al código anterior no revierte el esquema ni sus nuevos estados.

Validación automatizada y SHA se registran en el PR; UAT institucional queda en la matriz. Los fixtures históricos de otros módulos se crean explícitamente en la base aislada: no se simulan respuestas HTTP para esconder la eliminación del bypass de cartera. Altas, reactivaciones y reinscripciones se prueban por sus rutas reales.

#158 es externo al código: `main` sigue con protected=false y GitHub rechazó la aplicación de la política con HTTP 403 Resource not accessible by integration. No se considera cerrado ni protegido por este PR.
