# Historial de versiones 1.27.18–1.27.35

- **1.27.35 (PR dependiente de #181):** alumno edita datos propios de contacto en web/Expo mediante `PATCH /alumnos/me/perfil`. Importación masiva parcial acepta sólo alumnos nuevos válidos, omite duplicados, exige proveedor en cada fila y permite descargar un XLSX de correcciones con errores. Ver [flujo y auditoría](IMPORTACION_PARCIAL_Y_PERFIL_1.27.35.md).


- **1.27.34 (PR dependiente de #180):** importación masiva de alumnos con correo institucional de acceso, correo personal de contacto y selección de remitente Microsoft 365/GoDaddy por fila en Excel. Compatibilidad con CSV anterior, migración aditiva de correo personal, previsualización y confirmación transaccional conservadas. Ver [guía](CARGA_MASIVA_ALUMNOS_CORREOS.md).

- **1.27.33 (PR):** correo dual por usuario: alumnos Microsoft 365, personal y docentes GoDaddy por defecto, selección manual en web, migraciones MySQL/SQL Server y cliente Graph sin nuevas dependencias. Activación mediante configuración segura del certificado; ver [manual de despliegue](CORREO_DUAL_GRAPH_GODADDY.md). No hay nuevas funciones ni rutas en Expo.

- **1.27.32:** web de reinscripción a **ciclo posterior** para Control Escolar y Finanzas: expediente recuperado, plan compatible, retroceso/salto con motivo, previsualización de cargos, ajuste financiero de colegiatura y confirmación usando apertura/grupos existentes. Dentro del mismo ciclo permanece bloqueado hasta migración por periodo. Finanzas incorpora seguimiento paginado de alumnos con saldo, acceso telefónico y WhatsApp **manual**, previsualización de avisos de correo mediante SMTP/cola existente y KPIs por alumno; serie mensual alterna barras y líneas, importes y pagadores. Sin nuevos proveedores, migraciones ni mensajería por teléfono/WhatsApp automática. [Contrato y límites](FINANZAS_REINSCRIPCION_COBRANZA_1.27.32.md). **Pendiente CI/UAT antes de producción.**


- **1.27.31:** búsqueda por matrícula, nombre, apellidos o nombre completo (incluido segundo nombre en el campo existente); FINANZAS dispone de sugerencias opcionales de cargos adicionales por nivel, sin tarifas precargadas, con clave opcional de idempotencia para proteger reintentos del mismo actor. [Contrato de reinscripción por periodo](REINSCRIPCION_PERIODOS_Y_CARGOS_CONTRATO.md): diseño pendiente de autorización, **sin crear todavía un nuevo flujo de reinscripción ni migraciones**; Expo sin funciones de gestión.


- **1.27.30:** navegación responsive web: menú lateral a la derecha con botón hamburguesa a la derecha, fondo atenuado semitransparente que conserva visible la pantalla y corrección de la superposición de reglas genéricas para botones. Prueba E2E de alineación, fondo y contenido subyacente; sin cambios a Expo, roles o API.

- **1.27.29:** Superadmin modifica mensaje público de bienvenida y tamaño del logo en web; API con validaciones y migraciones espejo MySQL/SQL Server. Sin administración en la aplicación Expo.

- **1.27.28:** vista «Mi cuenta» con identificador, nombre, correo, teléfono, roles, estado y seguridad consultados de `/auth/me`; lectura privada y controles de recarga, recorrido y cambio de contraseña. Sin modificación de cuentas ni migraciones.

- **1.27.27:** recorrido de bienvenida según áreas autorizadas para cada rol web, con omitir, siguiente, finalizar y «Ver recorrido»; recordatorio por cuenta/navegador con localStorage, sin tokens ni nueva lógica de permisos.

- **1.27.26:** reflujo para monitores grandes, logotipo institucional más visible y acciones de usuarios separadas sin superponerse; sin nuevas dependencias ni migraciones.

- **1.27.24:** contrato de diseño preparatorio del módulo de cuentas por pagar. No agrega endpoints, tablas ni recordatorios; requiere aprobación financiera. [Contrato](CUENTAS_POR_PAGAR_CONTRATO.md).

- **1.27.23:** programación opcional, apagada por defecto, de avisos a cartera efectivamente vencida el día 3 y recargos elegibles del 10% desde el día 4. Exige actor FINANZAS vigente, planteles autorizados y SMTP. No se altera el vencimiento por defecto día 5; nada se activa sin aprobación institucional.

- **1.27.22:** gráfica de seis meses de ingresos confirmados para FINANZAS al abrir el panel, filtrada por plantel de origen; sin nuevas dependencias ni migraciones.

- **1.27.21:** reportes privados de estado de cuenta PDF y bajas actuales XLSX; sin cambios a recargos, mensajería automática, motor de cobros ni base de datos. [Alcance financiero](FINANZAS_REQUERIMIENTOS_2026-10-22.md).

- **1.27.20:** contrato técnico propuesto para la versión objetivo 1.28.0: cuatro parciales, NP y asistencia informativa, transición histórica y permisos. Sin cambio de notas ni migraciones; requiere aprobación institucional. Actualiza Vitest para resolver avisos de seguridad en pruebas. [Anexo y límites](IMPLEMENTACION_EVALUACIONES_1.28.0.md).
- **1.27.19:** limpieza documental: se retiran doce resúmenes/inventarios históricos recuperables en Git, se simplifican índice y estado y se actualizan contratos de referencia. Sin cambios funcionales ni migraciones.
- **1.27.18:** Web admite PNG/JPG/WebP de hasta 20 MiB, convierte en el navegador a WebP de hasta 10 MiB y verifica lectura pública tras cargar. API admite solo WebP optimizado, almacena temporalmente fuera de la ruta pública y protege la referencia anterior en fallos. Identidad pública sincronizada entre pestañas web y al volver a primer plano o cada minuto activo en Expo; web conserva marca válida en localStorage, Expo en SecureStore, metadatos sin caché HTTP y logos únicos con caché inmutable. IIS exige límite efectivo ≥11 MiB y UAT de archivos/ACL; sin migraciones.


Resumen histórico trasladado del README en 1.27.40; las referencias a PR pendientes y resultados describen su corte original. Para el estado consolidado consultar [Estado de implementación](ESTADO_IMPLEMENTACION.md).
