# Reinscripción por periodo y cargos adicionales — contrato de implementación

**Estado:** diseño de la operación transaccional **pendiente de aprobación académica y financiera**. La versión 1.27.31 **no habilita reinscripciones automáticas**. Sí habilita búsqueda por nombre completo/matrícula y mejoras de cargos adicionales con idempotencia opcional.

## 1. Diagnóstico comprobado en `main` 1.27.30

- `backend/src/academico/promocion.service.ts`: mueve alumnos seleccionados de ciclo **CERRADO** a **PREPARACION**, en el mismo plantel, sin copiar notas ni emitir cargos; no valida aprobación de materias.
- `backend/src/cartera/cartera.service.ts`: apertura ordinaria y cargos ligados a solicitud de grupo, con preview, cotización, idempotencia y agrupación; se bloquea si ya existe apertura del alumno en el ciclo.
- `backend/src/entities/apertura-cartera.entity.ts`: `uq_apertura_alumno_ciclo` limita a una apertura por ciclo. `solicitud-grupo-regular.entity.ts` tiene `uq_solicitud_alumno_ciclo`, y los servicios de inscripción admiten solo un grupo regular activo por ciclo.
- `backend/src/entities/periodo-academico.entity.ts` ya contiene `ANUAL|SEMESTRAL|CUATRIMESTRAL`, `numero`, `carreraId` y `cicloId`. El número de periodos se debe derivar de **plan/periodos configurados**, no fijar siempre a nueve.
- `backend/src/recursamientos` conserva participación e intentos de asignatura; no se deben recrear ni eliminar antecedentes académicos para cobrar una materia.
- `backend/src/finanzas/cargos.service.ts` y `conceptos.service.ts`: FINANZAS puede registrar un cargo individual de concepto `OTRO` y ajustar monto/descuento. No existe un vínculo obligatorio del cargo con intento de recursamiento o trámite: **falta la conciliación semántica**.
- `Usuario.nombre` admite nombres compuestos en un solo campo; `apellidoMaterno` es nullable. No separar segundo nombre en un campo nuevo sin revisar migración de expedientes legados.

**Bloqueo de diseño real:** no es seguro ofrecer «reinscripción al siguiente cuatrimestre» dentro del mismo ciclo reutilizando `cartera.confirmar`: la unicidad de apertura y solicitud, así como la política de inscripción activa por ciclo, provocan conflictos. Tampoco es correcto desactivar la inscripción previa con estatus `BAJA` solo para permitir otra, porque ese estado tiene efectos académicos en recursamientos y reportes.

## 2. Organización de la web

En **Cartera escolar**, mostrar acciones claramente distintas: **Nueva apertura** (alumno sin operación del periodo de destino) y **Reinscribir alumno** (expediente ya existente), además de **Historial de cartera**. Reinscribir no es editar retrospectivamente la apertura anterior.

Asistente de reinscripción, sin pantallas administrativas en Expo:

1. Buscar por **matrícula O nombre completo** (uno basta), con nombre(s), apellido paterno y materno si existe. Debe haber resultados paginados, selección inequívoca por matrícula e identificación de plantel; no elegir automáticamente entre homónimos.
2. Consultar expediente de solo lectura: matrícula, nombre, plantel, programa/plan, modalidad, último periodo cursado, grupo, materias y calificaciones cerradas relevantes, materias pendientes, cargos previos, saldos y becas aplicables. Cada dato dentro del alcance de rol/plantel; mostrar solo lo necesario.
3. Seleccionar **periodo destino** dentro de los periodos reales del plan: secundaria **ANUAL** (1.º–3.º), bachillerato **SEMESTRAL** según plan, educación superior, licenciatura y posgrado **CUATRIMESTRAL** según plan. El backend verifica que el periodo pertenezca al plan del alumno y que haya contexto académico compatible; no inferirlo solo del nombre del nivel.
4. Si el destino es menor o igual al actual, requerir **tipo de excepción y motivo detallado** y autorización de Control Escolar según reglamento; mostrar las consecuencias de repetir materias. Si se salta un periodo hacia delante, requerir igualmente justificación y validación documental. La reprobación **no se infiere automáticamente** de una nota parcial o una falta de asistencia.
5. Proponer grupo/turno compatible con cupo vigente; si aún no hay grupo, registrar solicitud pendiente sin simular que quedó inscrito. Revisar situación de materias pendientes y ofrecer recursamientos asociados al intento real, no duplicar inscripciones regulares.
6. Cotización congelada de nuevo periodo: costo autorizado, calendario de pagos, beca/descuento y cargos complementarios **separados**. Cambios de importe para el periodo futuro requieren autorización de FINANZAS y motivo. No alterar cargos/pagos/recargos de periodos anteriores.
7. Pantalla de revisión: origen, destino, cambios, grupo/solicitud, cargos futuros, fecha de vencimiento, beca, conceptos extraordinarios y advertencias. Confirmación explícita con clave de idempotencia. Devolver recibo de operación y estado de agrupación.
8. Historial: quién, cuándo, por qué, origen, destino, importes autorizados y referencias académicas/financieras. Errores y conflictos no deben dejar registros parciales.

Estados UX: carga, sin coincidencias, varios homónimos, expediente fuera de alcance, ciclos no preparados, plan sin periodos, grupo lleno, materias sin cerrar, deuda informativa, cotización obsoleta, error de red, intento repetido y éxito.

## 3. Modelo objetivo (no implementado en 1.27.31)

Crear mediante **migraciones espejo MySQL/SQL Server** una operación histórica de reinscripción con `alumnoId`, periodo origen/destino, ciclo(s), versión de plan, plantel, tipo de movimiento (AVANCE / REPETICION / REGULARIZACION / CORRECCION), justificación, actor, fecha, estado, idempotencia única, hash de cotización e importes congelados. No reescribir la apertura original.

Revisar unicidad por **alumno y periodo académico**, nunca solo por ciclo; evaluar todas las lecturas, conciliaciones, reportes y rutas que hoy asumen uno por ciclo. No retirar restricciones hasta actualizar consultas y validar que las filas antiguas puedan asignarse inequívocamente a un periodo. Las inscripciones históricas no deben pasar a `BAJA` por avance normal; definir estado de «FINALIZADA/CONCLUIDA» solo si existe consenso académico y migración compatible. Conservar eventos de promoción existentes.

**Cotización por periodo**: snapshot de tarifa autorizada y aprobación de ajuste; no cargar ningún cargo antes de asignación/grupo según la política actual sin revisar expresamente el comportamiento de solicitudes pendientes. Los cargos resultantes apuntan a una operación/periodo para control de duplicados. Las claves únicas deben cubrir alumno + periodo + concepto + vencimiento/cuota, admitiendo pagos parciales sin repetir conceptos en reintentos. Bloquear transaccionalmente plantel, ciclo, alumno, inscripción, solicitud y cargo en el orden establecido en el repositorio.

**Aprobación académica**: consulta del historial de `Calificacion`, `GrupoMateria` y recursamientos. Una materia pendiente debe enlazarse al mismo plan/asignatura, preservar intento, requisitos y capacidad. Prohibido generar materias reprobadas basándose en asistencias o evaluaciones no cerradas. Condiciones de regularidad, repetición, equivalencia, materias seriadas y autorización de saltos las define el reglamento institucional aprobado.

## 4. Precios por nivel y periodos

| Oferta | Unidad académica | Cotización base | Pago configurable |
| --- | --- | --- | --- |
| Secundaria | Año escolar | Total anual autorizado | Pago del año completo, según regla institucional comunicada |
| Bachillerato | Semestre | Total semestral autorizado | Importe del semestre; parcialidades solo si el plantel lo autoriza |
| Licenciatura, especialización, maestría, doctorado | Cuatrimestre, si así se configura el plan | Total del cuatrimestre | Mensualidades de ese cuatrimestre según calendario; nunca generar meses por encima del total |

Se debe aplicar descuento o beca sobre el alcance autorizado (total o cuotas) **una sola vez**, con vigencia explícita y trazabilidad. Cuando cambia el precio para un periodo futuro, mantener precio de periodos anteriores sin recalcular pagos ya confirmados. No generar colegiaturas mensuales adicionales si el cobro anual/semestral ya saldó la obligación correspondiente.

## 5. Asignar cargos adicionales — operativo desde 1.27.31 con catálogo existente

La web de FINANZAS conserva `POST /finanzas/cargos` y `/finanzas/conceptos` para tipos `OTRO` y otros conceptos autorizados. Se incorporan sugerencias **sin monto ni alta automática**: regularización, examen extraordinario, recursamiento, duplicado de certificado, constancia, reposición de credencial, curso complementario, titulación, examen profesional, certificado parcial/total y constancia administrativa de servicio social. El filtro de «cargo adicional» no propone colegiaturas; las genera el flujo específico. Los conceptos son opcionales y requieren que Finanzas confirme si se presta el servicio, cuánto cuesta y en qué nivel procede.

La **reprobación por sí sola no autoriza un cargo automático**: un extraordinario o recursamiento debe estar asociado a una solicitud/participación real del alumno y a las políticas institucionales. Los derechos de cédula, equivalencia, revalidación u otros trámites pagaderos **directamente ante la autoridad** no deben facturarse como ingreso institucional sin contrato/mandato jurídicamente válido y separación de conceptos.

En la versión 1.27.31 el formulario de cargos incluye una clave UUID de idempotencia opcional en la API y estable en reintentos web. Una petición repetida del mismo actor con mismos importes obtiene el mismo cargo; otra petición que intente reutilizar la clave con importes distintos se rechaza. **No significa que todos los conceptos ya tengan idempotencia semántica por servicio**; falta vincularlos a trámites/recursamientos reales.

## 6. Seguridad y aprobación

- `ADMINISTRATIVO` lleva el avance/retroceso académico en su plantel. `FINANZAS` autoriza el precio del periodo, becas, descuentos y cargos. `SUPERADMIN` resuelve excepciones de reglamento, con bitácora y política expresa de roles; no suponer que esconder botones autoriza endpoints.
- No bloquear entrega de boletas, certificados ni documentos por adeudos. No publicar deudas, nombres o calificaciones en logs ni mensajes públicos.
- Nunca aumentar unilateralmente colegiaturas **dentro del periodo contratado**; informar por adelantado importes y calendario. Contrato y reglamento institucional deben revisar niveles e incorporaciones.
- Expo alumno solo recibe historial de nuevo periodo, materias/recursamiento autorizados, cuotas y estado de cuenta, **nunca** flujos de gestión.
- Todas las operaciones nuevas requieren Swagger, DTOs estrictos, scopes, historial y errores en español. Sin dependencias nuevas para el flujo propuesto.

## 7. Endpoints *propuestos, no existentes*

- `GET /cartera/reinscripciones/elegibles?buscar=...`: resultados paginados y restringidos por plantel.
- `POST /cartera/reinscripciones/previsualizar`: elegibilidad, materias, contexto y cotización; devuelve hash y advertencias, sin escrituras.
- `POST /cartera/reinscripciones/confirmar`: idempotente, bloqueos y commit indivisible de reinscripción, solicitud/grupo y cargos; cotejo de hash.
- `GET /cartera/reinscripciones/:id`: operación histórica y recibo, dentro del scope.
- `POST /finanzas/reinscripciones/:id/autorizacion-precio`: firma de nuevos importes/becas antes del commit; jamás alteración unilateral de cargos pagados.

No implementar aún estas rutas sin acordar modelo histórico, responsables y migraciones. Evitar colisiones de `/cartera/:id` colocando rutas literales antes de rutas con parámetro.

## 8. Pruebas de aceptación obligatorias

1. Matrícula sola y nombre completo con dos nombres o sin apellido materno; dos personas homónimas obligan a seleccionar matrícula.
2. Secundaria 1→2 anual, bachillerato 2→3 semestral y licenciatura/posgrado 3→4 cuatrimestral según plan real; límites de periodos no fijos.
3. Retorno 3→2 con motivo y permiso; salto 2→4 con revisión; impedir avance de plan inactivo/no compatible.
4. Materia reprobada con intento de recursamiento activo: se preserva el intento, la nota histórica y el límite de cupo; sin duplicado académico.
5. Beca y precio nuevo solo para periodo destino; origen pagado no muta. Secundaria anual sin cargos mensuales repetidos; superior cuatrimestral con total igual a cuotas.
6. Dos confirmaciones concurrentes con misma o distinta clave producen una sola operación y cargos únicos; hash obsoleto produce conflicto sin escrituras.
7. Cambio de plantel concurrente, grupo lleno, alumno BAJA, periodo inexistente y ciclo cerrado rechazan operaciones fuera de reglas.
8. Pagos previos, reportes, boletas y PDFs conservan historiales de todos los periodos. Finanzas del plantel sin acceso a otros.
9. Recargo no se aplica antes de vencimiento; un extraordinario sin solicitud no se cobra por defecto.
10. Accesibilidad AA, teclado, reintentos por falla de red, móvil web responsive, sin gestión en Expo.
11. Pruebas reales MySQL 8.4 + SQL Server 2022 con datos históricos, rollback no destructivo y doble confirmación bajo concurrencia.

## 9. Preguntas institucionales de bloqueo antes de activar

- ¿Todo el alumnado de educación superior usa cuatrimestres o algún plan de maestría/doctorado tiene semestres? Debe prevalecer el plan configurado.
- ¿Cuál es la regla formal de avance con materias reprobadas y quién aprueba regresiones, saltos, equivalencias y recursamientos?
- ¿Cuál es el máximo real de periodos por plan y el calendario oficial de cada cohorte?
- ¿Las cuotas y becas continúan entre periodos o se autorizan nuevamente? ¿Quién aprueba cambios de tarifa?
- ¿El acto de reinscribir reserva grupo antes del pago, después del pago o sin condición económica? No bloquear documentos ni derechos.
- ¿Cuándo una solicitud es «pendiente» y cómo impedir que se generen cargos antes de concretar una asignación?
- ¿Cómo se factura y distingue un derecho federal de una gestión interna para evitar doble cobro?

## 10. Referencias de verificación jurídica

- PROFECO, información sobre cuotas extraordinarias, exámenes, cursos de regularización, certificados, constancias y descuentos: https://www.gob.mx/profeco/es/articulos/escuelas-particulares-lo-que-debes-saber?idiom=es
- PROFECO (2025), prohibición de aumento unilateral y retención de documentos: https://www.gob.mx/profeco/prensa/escuelas-particulares-profeco-explica-cuales-son-los-derechos-de-las-y-los-usuarios
- Ley General de Educación, protección ante adeudos: https://www.gob.mx/sep/articulos/decreto-por-el-que-se-expide-la-ley-general-de-educacion-y-se-abroga-la-ley-general-de-la-infraestructura-fisica-educativa
- SEP/DGAIR, equivalencia de educación superior (pago de derechos a la autoridad): https://dgair.sep.gob.mx/dir/equivalencias_superior
