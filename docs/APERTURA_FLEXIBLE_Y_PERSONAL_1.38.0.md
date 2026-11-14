# Apertura flexible y personal con varias funciones · 1.38.0

La entrega se apoya en la preparación académica de 1.37.0 (PR #244). No añade migraciones ni cambia los calendarios, cupos, tarifas, pagos o requisitos de reinscripción existentes.

## Apertura integral

- Se conserva la elección obligatoria de plantel, ciclo y nivel académico activo del plantel. El catálogo de niveles puede incluir Secundaria, Bachillerato, Licenciatura, Maestría, Doctorado y Posgrado; se muestran los nombres configurados, sin crear registros implícitos.
- Carrera/plan y periodo son opcionales para registrar la apertura. Todos los IDs proporcionados se comprueban en el servidor: plan del nivel y plantel, periodo del plan, ciclo y plantel. Un periodo sin plan es inválido.
- El formulario ofrece asignación automática por defecto. La asignación efectiva sigue usando contexto completo y la distribución vigente. Sin plan/periodo, se guarda alumno y apertura en PAUSA, sin inscripción ni cargos. El calendario de cuotas se valida provisionalmente contra el ciclo.
- Desde el detalle se completan los campos pendientes y se reanuda la asignación automática o se elige un grupo compatible. La reanudación no permite reemplazar un plan o periodo ya contratado; vuelve a validar el calendario, estado, alcance, cupo y reglas de cargos. Si el calendario ya no es compatible, requiere revisión.
- Los grupos pueden estar vacíos o carecer de materias. Una materia puede crearse y asignarse al grupo sin profesor; el profesor se asigna posteriormente por grupo/materia.
- El detalle muestra recordatorios calculados al consultarlo: contexto incompleto, alumno sin grupo, grupo sin materias, materias del periodo pendientes y materias sin profesor activo. Desaparecen al corregir los datos. Son avisos en pantalla; no se programa envío de correos o notificaciones externas.

## Misma cuenta con varias funciones

- Desde el alta de Docentes puede elegirse una cuenta de personal existente y registrar su número de empleado, cédula (o pendiente) y especialidad. No se crea otro usuario, no se modifica su contraseña ni se envía invitación nueva.
- Se añade MAESTRO conservando ADMINISTRATIVO, FINANZAS o DIRECTOR; exige planteles activos, autorización sobre todos ellos y jerarquía suficiente. No admite convertir identidades ALUMNO ni modificar la propia cuenta o cuentas protegidas.
- Una cuenta docente puede recibir otras funciones desde Asignación de funciones según la jerarquía existente. No se habilita autoasignación de privilegios.
- La baja docente de una cuenta compartida retira MAESTRO y libera sus clases, pero conserva la cuenta activa, sus otros roles y planteles. La reactivación recupera MAESTRO sin expandir planteles. Se revocan sesiones y se registra historial.
- Los planteles de cuentas compartidas se administran desde Usuarios, para evitar que una asignación docente amplíe indirectamente el alcance financiero o administrativo.

## Punto por confirmar

El código actual no define un rol COORDINADOR: Control Escolar opera con ADMINISTRATIVO. Se solicitó aclaración sobre si Coordinador es esa función o una función nueva con permisos específicos. Esta entrega permite combinar las funciones existentes y no inventa permisos para un rol nuevo.

## Verificación

Casos automatizados en `apertura-flexible.cases.ts`: apertura parcial sin cargos, completar contexto, grupo sin materias, profesor pendiente, cuenta única con DIRECTOR/ADMINISTRATIVO/FINANZAS + MAESTRO y baja/reactivación sin perder otras funciones. Pruebas unitarias comprueban DTO y aislamiento de contexto; pruebas web cubren campos pendientes y vinculación por ID. Los resultados concretos de CI corresponden al SHA de la entrega; no acreditan UAT, envío real ni despliegue.
