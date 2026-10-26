# Recorridos por área y comparativas · 1.27.54

Base: main 1.27.53 integrado por #202. Esta entrega amplía la experiencia existente; no duplica las herramientas ya implementadas ni activa infraestructura institucional.

## Recorridos especializados

Web permite elegir Finanzas y cobranza, Administración/control escolar, Docencia, Superadministración y Mi cuenta. Cada guía contiene herramientas concretas, rutas de consulta, explicación y comprobación antes de operar. El catálogo se filtra por roles y secciones realmente permitidas; roles mixtos suman áreas, no privilegios académicos. SUPERADMIN puede revisar todas las guías, pero se explica que tampoco captura asistencias sin ser profesor asignado.

El recorrido navega a pantallas y vistas de consulta reales, destaca su acceso, permite Anterior/Siguiente, cambiar área, Escape, omitir y repetir desde menú/Mi cuenta/Configuración. No rellena ni envía formularios, no registra pagos, no cambia roles ni publica contenido. La clave web v2 por cuenta/roles permite presentar la nueva guía una vez sin reutilizar silenciosamente la marca v1. Si el almacenamiento está bloqueado, se conserva la posibilidad de omitir durante esa sesión.

Expo: nueve pasos exclusivos de ALUMNO: inicio y pendientes, calendario/asistencias, materias/temarios, entregas, notas/boletas, pagos, trámites, preferencias/sesiones y perfil/documentos. Modal desplazable, botones de tamaño táctil, omitir/finalizar, pausa para ver la pantalla real y continuación; repetición desde Perfil. Guarda solamente una preferencia por cuenta en SecureStore, sin expedientes ni enlaces privados. Los detalles de tareas y documentos se abren por selección del alumno, no con identificadores ficticios. Android/iOS físicos y lector de pantalla requieren UAT independiente.

## Gráficas y métricas

GET /api/analitica/comparativas acepta cicloId, plantelId y fechas civiles desde/hasta opcionales. Sin fechas usa el intervalo del ciclo; un intervalo explícito permite revisar inscripciones anticipadas o cobros posteriores del mismo ciclo. Hasta cinco años por consulta. La API aplica ScopeService antes de agregar datos, no confía en el selector del cliente.

Seis gráficas independientes, con barras/líneas por gráfica, resumen, selección por teclado, etiquetas, tabla completa y desplazamiento interno en pantallas pequeñas:

1. Ingresos por plantel.
2. Ingresos por carrera.
3. Evolución mensual de ingresos.
4. Alumnos inscritos por plantel.
5. Alumnos inscritos por carrera.
6. Evolución mensual de primeras inscripciones en el ciclo.

La gráfica de cobranza existente reutiliza la nueva presentación. Marca configurable, foco, controles y tablas se conservan. Las líneas entre categorías no temporales se explican expresamente y no se presentan como una tendencia en el tiempo. Los meses sin filas se completan con cero; ausencia de categorías se distingue de registros con cero.

**Ingresos:** pagos CONFIRMADO aplicados a cargos del ciclo, por fecha de pago y plantel histórico del pago. Excluye pagos cancelados/no aplicados y pagos de cargos sin ciclo identificable; no es todo el efectivo del banco ni utilidad contable. La carrera se identifica solo si el cargo vincula una programación del mismo alumno/ciclo/plantel, a través de su periodo y carrera. Cobros sin ese vínculo permanecen en «Sin carrera identificada»; no se atribuyen a la carrera actual del alumno ni se reparten arbitrariamente. La clasificación depende del catálogo/periodo asociado, no constituye un snapshot contable inmutable.

**Inscritos:** COUNT(DISTINCT alumno) por categoría con inscripción en el intervalo. Una persona con dos grupos de la misma carrera cuenta una vez; con varias carreras/planteles puede figurar en varias categorías y sus sumas no son alumnos institucionales únicos. Evolución: primera inscripción del alumno en el ciclo dentro del alcance; no significa necesariamente nuevo ingreso a la institución. Ciclo cerrado conserva participantes históricos; vigente excluye inscripción/alumno/usuario inactivos. Un alumno inscrito antes del comienzo del ciclo requiere ampliar el intervalo para estudiar esa fecha de alta.

FINANZAS recibe comparativas financieras; por sí solo no recibe el bloque académico. MAESTRO ve inscripciones limitadas a sus grupos y no recibe finanzas sin capacidad financiera. ADMINISTRATIVO y SUPERADMIN consultan según capacidades vigentes y planteles asignados/global. MAESTRO+FINANZAS conserva clases propias y recibe finanzas del alcance financiero; nunca estadísticas académicas globales por agregar FINANZAS.

## Cierre de pendientes de #202

| Solicitud | Estado en código |
|---|---|
| Editar evento/ciclo/nivel/audiencia, sustituir imagen y eliminar con confirmación | Implementado en #202; se conserva |
| Plantel junto a nivel y resumen de destino | Implementado en #202; se conserva |
| Sincronizar listado/cuadrícula | Implementado en #202; se conserva |
| Carga, errores y reintento de imágenes | Esta entrega distingue estados y permite renovar el enlace; invalida imagen al cambiar archivo del mismo evento |
| Agenda accesible y teclado | Agenda web/Expo de #202; gráficos y guías añaden foco y tablas |
| Trazabilidad | Historial de calendario de #202; historial de asistencias ahora consultable en web por personal autorizado |
| Pendientes por rol | #202; ahora visibles al entrar a Inicio Expo sin abrir el panel desplegable |
| Calidad de datos y correcciones con vista previa | Diagnóstico #202; ahora teléfono/CURP con antes/después, revisión vinculada a los valores y confirmación transaccional. No fusiona duplicados ni infiere grupo/nivel; esas inconsistencias exigen revisión en editores/operación existentes |
| Conciliación bancaria y trámites | #202; se conserva preview, idempotencia, responsable e historial |
| Preferencias y avisos frente a acciones | Preferencias #202; bandeja explica que leer un aviso no resuelve una tarea/cargo/trámite |
| Recuperación operativa | Scripts y alerta #202; siguen pendientes configuración Windows, cuentas/certificados, copia externa, instalación y restore real |
| Sesiones por dispositivo | Añade etiqueta acotada de navegador/sistema; no guarda agente bruto, IP ni hardware. No es prueba de identidad. Las sesiones anteriores indican «Dispositivo no identificado» |

## Migración y aceptación

Migración aditiva espejo `migracion_dispositivo_sesion.sql`: columna sesiones.dispositivo, NOT NULL con default para las filas anteriores. Entidad, manifiesto y schema documental sincronizados; baseline v1 intacto. Se requiere aplicar por el procedimiento operativo antes de iniciar la API nueva; no ejecutar schema.sql completo ni DB_SYNC=true.

UAT-37–41 se incorporan pendientes. Las pruebas locales/CI no acreditan despliegue IIS, dispositivos físicos, accesibilidad con lector real, entrega SMTP ni restore institucional. No se emiten correos, cobros ni escrituras en servidores reales desde estas validaciones.

## Próximas prioridades después de validar esta entrega

1. Cerrar CI del SHA final, migraciones en copia histórica y UAT por área; ensayar respaldo y restauración con archivos reales sanitizados.
2. Formalizar catálogo de estados, tiempos de respuesta y responsables de trámites; después incorporar adjuntos privados y documentos con firma autorizada.
3. Para rentabilidad real, definir costos/gastos por plantel/carrera y reglas de distribución; no convertir ingresos en utilidad sin esas bases.
4. Mejorar calidad de catálogos y atribución histórica de cargos antes de automatizar comparaciones institucionales o importaciones bancarias por formato.
5. Acordar horarios, sesiones múltiples por día y normativa de justificaciones si se necesita ampliar asistencias; mantener su separación de calificaciones hasta aprobación.
