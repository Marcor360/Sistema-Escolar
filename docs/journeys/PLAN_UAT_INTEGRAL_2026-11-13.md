# Plan de UAT por rol, módulo y plataforma — 13/nov/2026

**Estado inicial de TODOS los casos:** PENDIENTE. Son pasos verificables basados en los flujos del repositorio 1.37.0, **no un registro de pruebas ejecutadas ni una aceptación institucional**. Si se ejecutan, usar usuario/persona/ciclo/plantel sintéticos en una base AISLADA con migraciones reales, sin enviar correo a personas reales ni hacer cargos externos. Tomar evidencia (SHA, fecha, rol, motor, viewport, HTTP, pantalla y resultado, siempre sin PII).

## Entorno, herramientas y responsabilidades

- Backend: NestJS, prueba integración con RUN_DB_INTEGRATION=1 y base aislada; repetir con MySQL y SQL Server.
- Web: Playwright, viewport 360/768/1280/1920, teclado y axe; jamás interceptar API para un resultado E2E «real».
- Expo: pruebas unitarias + portal web y dispositivo Android/iOS físico. La app Expo **solo ALUMNO**.
- UAT: 6 actores ficticios por plantel, cuentas multirol válidas, alumnos de distintos planteles, ciclo PREPARACION y ACTIVO, roles revocados y cuentas inactivas.
- Roles: S SUPERADMIN, D DIRECTOR, A ADMINISTRATIVO, F FINANZAS, M MAESTRO, L ALUMNO.
- Estados de UAT: PENDIENTE / BLOQUEADO / FALLÓ / APROBADO, con evidencia verificable; no cambiar el archivo institucional docs/UAT_MATRIZ_2026-10-15.json por simular un flujo.
- En todos los formularios: alta, búsqueda, edición, vacío, carga, error de red, recuperación, validación, no duplicado, foco, pantallas y acceso denegado. En operaciones sensibles, confirmar y verificar historial.

## Matriz de escenarios detallados

| ID | Rol / canal | Precondición | Pasos de usuario | Resultado esperado / criterio | Estado |
| --- | --- | --- | --- | --- | --- |
| J-UAT-001 | L / Expo | Cuenta invitada | Solicitar código, activar, iniciar sesión | Código previo inválido; nueva sesión del alumno correcto | PENDIENTE |
| J-UAT-002 | Todos / web-Expo | Token por expirar | Refrescar, salir, cambiar contraseña | Revoca sesiones antiguas, no filtra token | PENDIENTE |
| J-UAT-003 | Todos / web-Expo | Cuenta inactiva o revocada | Abrir ruta interna y API directamente | Rechazo del servidor; sin datos de terceros | PENDIENTE |
| J-UAT-004 | Todos / web-Expo | Sin conexión | Consultar y luego enviar operación | Estado de red y reintento; no anuncia éxito no confirmado | PENDIENTE |
| J-UAT-005 | Todos / web-Expo | Sesión activa | Inactividad 30 min | Cierre coordinado web/app/API sin acceso privado posterior | PENDIENTE |
| J-UAT-006 | S / web | Sin planteles | Registrar sede con clave, nombre, campos mínimos | Se crea sin docentes, director o alumnos; no aparece como grupo | PENDIENTE |
| J-UAT-007 | S / web | Sede creada | Editar contacto/marca y desactivar sede con vínculos | Respeta vinculaciones, ofrece mensaje concreto, conserva historial | PENDIENTE |
| J-UAT-008 | A/F/D / API | Sede fuera de alcance | Consultar/editar/crear plantel con token real | A/F/D no reciben POST /planteles permitido; S sí | PENDIENTE |
| J-UAT-009 | S / web | Dos sedes | Crear personal, asignar alcance, retirar sede | No escala privilegios ni permite datos de sede retirada | PENDIENTE |
| J-UAT-010 | S / web | Nuevo ciclo | Crear y activar; iniciar cierre y cerrar | PREPARACION no cambia vigente; cierre exige condiciones válidas | PENDIENTE |
| J-UAT-011 | S / web | Marca de prueba | Cambiar logo, favicon y textos | Persisten en administrativo/portal; upload validado y accesible | PENDIENTE |
| J-UAT-012 | S / web | Respaldos configurados | Consultar respaldo y alertas | Solo S accede; no restaura datos desde pantalla de usuario | PENDIENTE |
| J-UAT-013 | S / API | Registro con vínculos | Solicitar eliminación definitiva sin cumplir requisitos | 409/denegado; no genera orfandad | PENDIENTE |
| J-UAT-014 | D / web | Director con plantel asignado | Abrir boletas y filtrar plantel, ciclo, grupo | Ve solo su ámbito; pendiente revisión visible | PENDIENTE |
| J-UAT-015 | D / web | Boleta en revisión | Atender solicitud y consultar respuesta | Se conserva versión e historial sin alterar nota | PENDIENTE |
| J-UAT-016 | D / web | Personal subordinado | Asignar funciones permitidas | Revocación de sesiones; no modifica cuenta protegida | PENDIENTE |
| J-UAT-017 | D / API | Egreso, plan, historial compatibles | Registrar borrador de titulación | BORRADOR con RVOE sin determinar, sin firma SEP | PENDIENTE |
| J-UAT-018 | D / API | Otro plantel | Crear borrador egreso ajeno | Prohibido por alcance; no revela datos ajenos | PENDIENTE |
| J-UAT-019 | D / API | Plantel autorizado | Alta y desactivación de firmante | PENDIENTE_VALIDACION, sin almacenar claves privadas ni permitir firma | PENDIENTE |
| J-UAT-020 | D / web | Director autenticado | Buscar pantalla titulación completa | **BLOQUEO FUNCIONAL DE CÓDIGO:** ruta web no existe; requiere PR específico | PENDIENTE |
| J-UAT-021 | A / web | Plantel activo | Crear nivel «Licenciatura» o «Maestría» | Guardar sin alumnos/grupos/profesores; sin crear programas implícitos | PENDIENTE |
| J-UAT-022 | A / web | Nivel activo | Registrar carrera/plan con versión | Exige nivel/plantel compatibles, no materias obligatorias | PENDIENTE |
| J-UAT-023 | A / web | Plan y ciclo | Registrar periodo anual/semestral/cuatrimestral | No confunde periodo con parcial y valida referencias | PENDIENTE |
| J-UAT-024 | A / web | Sin ciclo/grupo | Crear materia por clave/nombre | Se guarda catálogo global sin plantel o profesor | PENDIENTE |
| J-UAT-025 | A / web | Materia existente | Vincular a dos planes/periodos autorizados | Reutiliza identidad global sin duplicar materia | PENDIENTE |
| J-UAT-026 | A / web | Materia con clases | Desactivar materia y buscar histórico | Protege clases vigentes, no borra notas | PENDIENTE |
| J-UAT-027 | A / web | Plantel y ciclo | Crear grupo sin materias ni profesor | Se guarda; vista muestra pendientes sin forzar asignación | PENDIENTE |
| J-UAT-028 | A / web | Grupo sin contexto | Agregar nivel/plan/periodo incompatibles | Rechazo explícito y datos del formulario conservados | PENDIENTE |
| J-UAT-029 | A / web | Grupo y materia | Asignar materia sin docente | Permite asignación y señal «Sin docente» | PENDIENTE |
| J-UAT-030 | A / web | Materia asignada | Asignar profesor de otro plantel | Denegado por API; no se expone clase al docente | PENDIENTE |
| J-UAT-031 | A / web | Docente en plantel | Vincular al grupo-materia y retirar | Auditoría y control de clases asignadas | PENDIENTE |
| J-UAT-032 | A/F/S / web | Plantel | Alta de expediente alumno con datos mínimos | No genera inscripción ni cargo automáticamente | PENDIENTE |
| J-UAT-033 | A/S / web | Expediente creado | Apertura ordinaria con contexto completo | Cotización/confirmación idempotente, asignación válida, sin doble cargo | PENDIENTE |
| J-UAT-034 | A/S / web | Alumno sin grupo | Confirmar apertura en pausa y reanudar | No crear cargos antes de condición; revalida elegibilidad | PENDIENTE |
| J-UAT-035 | A/S / web | Contexto parcial 1.38.0 | Crear alumno con nivel y plan/periodo pendientes | **BLOQUEADO en staging 1.37.0** hasta integrar PR #247 | PENDIENTE |
| J-UAT-036 | A / web | Alumno inscrito | Baja/reactivación/promoción autorizada | Mantiene calificaciones e historial; no permite reinscribir arbitrariamente | PENDIENTE |
| J-UAT-037 | A / web | Plantilla CSV | Previsualizar alumnos y datos corruptos | Separa válidos, repetidos e inválidos, no persiste hasta confirmar | PENDIENTE |
| J-UAT-038 | A / web | Plantilla CSV/XLSX | Importar materias y grupos | Filas válidas insertadas, duplicados omitidos; no crea profesor por omisión | PENDIENTE |
| J-UAT-039 | A / web | Ciclo de origen/destino | Promover alumnos con preview | Sin duplicados y con compatibilidad de grupos/cupos | PENDIENTE |
| J-UAT-040 | A / web | Grupo con datos históricos | Cambiar contexto incompatible | Evita alterar inscripciones/participaciones históricas | PENDIENTE |
| J-UAT-041 | M / web | Sin grupo-materia asignado | Abrir Mis clases y endpoints ajenos | Estado vacío, no ver clase de otro docente | PENDIENTE |
| J-UAT-042 | M / web | Clase asignada | Abrir clase → crear temario borrador → publicar | Estados borrador/publicado y fechas/archivos autorizados | PENDIENTE |
| J-UAT-043 | M / web | Clase asignada | Crear tarea sin vencimiento y consultar alumno | Aparece solo a inscritos; no genera calificación oficial | PENDIENTE |
| J-UAT-044 | M / web | Clase asignada | Crear tarea con vencimiento y peso informativo | Fecha/escala válidas y ayuda explícita en formulario | PENDIENTE |
| J-UAT-045 | M / web | Alumno entregó | Abrir entregas y ver archivo/texto | Solo la clase asignada, sin XSS ni URL pública | PENDIENTE |
| J-UAT-046 | M / web | Entrega no calificada | Registrar nota, comentario, corregir | Muestra retroalimentación propia del trabajo, conserva integridad | PENDIENTE |
| J-UAT-047 | M / web | Entrega calificada | Alumno intenta reemplazar | API rechaza reentrega; docente ve entrega histórica | PENDIENTE |
| J-UAT-048 | M / web | Parcial abierto | Capturar nota oficial, corregir con motivo | Auditoría y escala vigentes, separada de la entrega | PENDIENTE |
| J-UAT-049 | M/A / web | Parcial cerrado | Modificar nota sin reabrir/rol | Rechazado; conserva nota original | PENDIENTE |
| J-UAT-050 | M / web | Clase asignada | Registrar asistencia y consultar historial | Solo sus clases; admin no captura sin rol M efectivo | PENDIENTE |
| J-UAT-051 | M/A / web | Alumno inscrito | Registrar incidencia de conducta | Sin sanción/nota/cargo automático, solo ámbito permitido | PENDIENTE |
| J-UAT-052 | M/A / web | Materia reprobada | Gestionar recursamiento y revisar notas | No genera por sí mismo nueva colegiatura | PENDIENTE |
| J-UAT-053 | L / Expo | Sesión válida, inscripción | Abrir inicio, materias y recursos | Solo sus clases; estados vacíos y fallos de red visibles | PENDIENTE |
| J-UAT-054 | L / Expo | Tarea activa | Entregar texto de 1-3000 caracteres | Confirma solo con respuesta real servidor | PENDIENTE |
| J-UAT-055 | L / Expo | Tarea activa | Adjuntar archivo válido e inválido | Límites/formatos, progreso y reintento sin falso éxito | PENDIENTE |
| J-UAT-056 | L / Expo | Entrega no evaluada | Reemplazar tras confirmar | Mantiene un único registro operativo, cambia respuesta autorizada | PENDIENTE |
| J-UAT-057 | L / Expo | Entrega evaluada | Intentar reemplazo | UI informa y API impide; retroalimentación disponible | PENDIENTE |
| J-UAT-058 | L / Expo | Nota de tarea | Consultar Calificaciones y boleta | Nota oficial no cambia automáticamente por tarea | PENDIENTE |
| J-UAT-059 | L / Expo | Boleta publicada | Aceptar o solicitar revisión | Respuesta propia, historial de versiones; sin alterar nota | PENDIENTE |
| J-UAT-060 | L / Expo | Cargo pendiente | Ver estado, ficha e intentar pago | Confirmación externa, sin ingreso antes de aplicación | PENDIENTE |
| J-UAT-061 | L / Expo | Cuenta con adeudos | Ver PDFs y pagos sin red | No exponer otros alumnos ni datos obsoletos como confirmados | PENDIENTE |
| J-UAT-062 | L / Expo | Cuenta activa | Solicitar trámite y cancelar a tiempo | Estado, historial y autorización por dueño | PENDIENTE |
| J-UAT-063 | L / Expo | Sesión propia | Revisar calendario, asistencias y avisos | Audiencia/plantel correctos; no administrar datos | PENDIENTE |
| J-UAT-064 | L / Expo | Dos cuentas distintas | Cambiar usuario y consultar caché | No mostrar archivos o notas de otra cuenta | PENDIENTE |
| J-UAT-065 | F / web | Catálogo sin conceptos | Crear concepto de colegiatura con $0 | Queda preparatorio; no emite cargo | PENDIENTE |
| J-UAT-066 | F / web | Concepto autorizado | Cambiar tarifa para futuros periodos | Cargos históricos conservan monto; tipo de concepto histórico no se corrompe | PENDIENTE |
| J-UAT-067 | F / web | Alumno elegible | Generar cargo adicional con UUID y reintentar | Una sola deuda; no permite simular colegiatura manual | PENDIENTE |
| J-UAT-068 | F / web | Concepto/colegiatura | Programar secundaria anual, bachillerato semestral, superior mensual | Cotización correcta, política por nivel aceptada por institución | PENDIENTE |
| J-UAT-069 | F / web | Programación confirmada | Emitir cuota solo tras inscripción válida | Sin doble emisión por periodo; vista de saldo coherente | PENDIENTE |
| J-UAT-070 | F / web | Cargo vigente | Registrar pago manual parcial con mismo intento | Idempotencia, saldo actualizado, referencia conservada | PENDIENTE |
| J-UAT-071 | F / web | Cargo sin pagos | Cancelar con motivo | Conserva auditoría; no afecta otros cargos | PENDIENTE |
| J-UAT-072 | F / web | Cargo pagado o con orden | Intentar cancelar y reutilizar UUID | Rechazado sin pérdida de dinero o historial | PENDIENTE |
| J-UAT-073 | F / web | Banco CSV y datos prueba | Preview → confirmar → aplicar movimiento | Conciliación idempotente, sin pagos duplicados | PENDIENTE |
| J-UAT-074 | F / web | Ficha PDF emitida | Consultar ficha sin depósito | No aparece como pagado solo por generar ficha | PENDIENTE |
| J-UAT-075 | F / web | Cartera con adeudos | Exportar, filtrar y contactar | Filtros por plantel, consentimiento y plantilla; no envía en simulación | PENDIENTE |
| J-UAT-076 | A / web | Evento de ciclo | Crear/editar calendario para audiencia | Fecha, nivel y plantel coherentes; histórico cuando aplica | PENDIENTE |
| J-UAT-077 | A / web | Plantel, destinatarios | Crear borrador de comunicado y preview | No se publica hasta confirmación; no duplica destinatarios | PENDIENTE |
| J-UAT-078 | A / web | Biblioteca de plantel | Crear carpeta y subir archivo privado | Scanner, peso y permisos; alumno no accede al fichero | PENDIENTE |
| J-UAT-079 | A / web | Calidad de datos | Detectar y corregir teléfono/CURP con preview | Comparación antes/después sin fusión de expedientes | PENDIENTE |
| J-UAT-080 | A/F/M / web | Datos mezclados | Ejecutar reportes/analítica por plantel y rol | Conteo/ingresos/inscripciones correctos sin cruces indebidos | PENDIENTE |
| J-UAT-081 | S / operación | Staging respaldado | Restaurar en copia aislada | RTO/RPO medidos sin tocar staging ni perder información | PENDIENTE |
| J-UAT-082 | Integración | MySQL + SQL Server | Migrar baseline y DDL incremental | Idempotencia, FK/índices equivalentes y sin DDL destructivo | PENDIENTE |
| J-UAT-083 | Web todos | Pantallas a 360-1920 px | Teclado/foco, validación y lectura asistida | AA y controles accesibles sin overlays irresolubles | PENDIENTE |
| J-UAT-084 | L / Android/iOS | Dispositivo real y permisos | Cambiar red, seleccionar archivo, guardar y cerrar | Sin datos privados en almacenamiento plano; sesiones y archivos seguros | PENDIENTE |

## Modelo de ficha de ejecución

Por cada ID registrar: `id`, `fecha`, `SHA`, `versión`, `plataforma`, `motor`, `plantel ficticio`, `actor`, `precondiciones`, `pasos`, `resultado obtenido`, `captura sanitizada`, `logs sin PII`, `estado`, `responsable` y `seguimiento`. No marcar APROBADO con una captura 200 genérica o un mock de API.

## Puertas de calidad

1. Función cubierta por test unitario y prueba de rol negativa.
2. Flujo E2E real en base aislada, sin redirecciones manuales ni API simulada.
3. Aceptación de persona institucional que ejecuta el proceso.
4. Para cambios de datos: previa + confirmación + idempotencia + bitácora + reversión permitida o historial inmutable.
5. Para medios externos: sandbox/proveedor, certificados, colas, consentimiento y responsables.
6. Antes de staging: CI verde del SHA definitivo y release nueva. Nunca desplegar PRs borrador ni crear migraciones por suposición.
