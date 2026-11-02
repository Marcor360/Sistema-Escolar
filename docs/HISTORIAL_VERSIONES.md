# Historial de versiones

Los números de entrega describen código; no acreditan despliegue ni aceptación institucional. Los pendientes citados pertenecen a cada corte histórico.

## Entregas 1.27.43–1.35.14 (integradas en main al 2/nov/2026)

- **1.35.14:** auditoría de estabilización y actualización coordinada de API, administración y Portal Alumno. [Guía de actualización](ACTUALIZACION_INTEGRAL_1.35.14.md) y [diagnóstico/valor estimado](AUDITORIA_Y_RUTA_PRODUCTIVA_2026-11-01.md). Sin despliegue automático.

- **1.35.13:** controles de ojo accesibles en todos los campos de contraseña de web y Expo, y confirmaciones explícitas en activación/recuperación web; sin cambios de base respecto a 1.35.12.

- **1.35.12:** avisos por correo tras cada inicio de sesión, recuperación y cambio de contraseña, con reintentos e historial mínimo en BD. Requiere migración auth_eventos_seguridad (MySQL/SQL Server).

- **1.35.11:** código nuevo invalida al anterior en activación y recuperación tras cooldown de 60 segundos; pruebas de regresión. Sin migraciones.

- **1.35.7:** corrige el hostname real del portal Expo Web del alumno (`stagin-portal-alumno.iua.edu.mx`) en los scripts de despliegue, configuración IIS y documentación; acepta certificado comodín `*.iua.edu.mx` válido y añade prueba de regresión del dominio. Sin cambios de negocio ni migraciones. [Despliegue Portal Alumno](DESPLIEGUE_PORTAL_ALUMNO_STAGING.md).

- **1.35.1:** publicación independiente de Expo Web en IIS para el alumno, proxy `/api` de mismo origen por cookie SameSite Strict, versión inmutable, rollback de Junction y pruebas de contrato. [Despliegue Portal Alumno](DESPLIEGUE_PORTAL_ALUMNO_STAGING.md). No implica que el nuevo dominio esté publicado.

- **1.32.0:** [Estabilización y seguimiento](ESTABILIZACION_1.32.0.md): Vite 6.4.5, recorrido de cartera en CI, detalle independiente y pendientes administrativos por plantel.

- **1.31.1:** [Revisión UX/UI](REVISION_UX_1.31.1.md): campos y cuotas alineados, datos visibles en tablas móviles, selectores compactos y guías de alta/acceso actualizadas.

- **1.31.0:** [Alta integral de alumno y cartera](CARTERA_INTEGRAL_1.31.0.md): correo posterior desde Usuarios, pausa sin cargos, total y cuotas del periodo, pagos previos conservados y CURP única.

- **1.29.0:** [Inscripción y reinscripción segura por periodo](REINSCRIPCIONES_SEGURAS_1.29.0.md): autorización financiera, calendario de cuotas, conservación de historial y cierre del bypass de cartera.

- **1.28.0:** [Cuatro parciales, criterios y aprobación de Final](EVALUACIONES_1.28.0.md). Escala 0–10 en clases nuevas y ciclos abiertos; originales e históricos conservados. Decimales y aprobación manual vigentes; sin redondeo automático.

- **1.27.59:** [Entregas y conservación académica](ENTREGAS_CONSERVACION_1.27.59.md).

- **1.27.58:** [Tipos, hooks y aislamiento HTTP](DEUDA_TECNICA_1.27.58.md).

- **1.27.57:** [Egresos únicos, historial, compresión opcional y límites de retención](EGRESOS_HISTORIAL_RETENCION_1.27.57.md). Sin borrado automático de expedientes ni adjuntos.

- **1.27.56:** [Diseño adaptable y validación de la app](APP_RESPONSIVE_1.27.56.md).

- **1.27.55:** [Correos claros y UX de acceso/Inicio](CORREOS_UX_1.27.55.md).

- **1.27.54:** [Recorridos por área, comparativas y cierre de pendientes](RECORRIDOS_COMPARATIVAS_1.27.54.md).

- **1.27.53:** [Seguimiento, asistencias y operación](SEGUIMIENTO_ASISTENCIAS_1.27.53.md): solo el profesor asignado captura; alumnos consultan lo propio, administrativos sus planteles y SUPERADMIN global.

- **1.27.52:** calendario por ciclo y nivel, vistas mensual y de ciclo completo, imágenes privadas y fechas internas para personal. Consulta de alumno en web/Expo. [Contrato](CALENDARIO_CICLO_NIVEL_1.27.52.md) y [barrido del proyecto](BARRIDO_PROYECTO_2026-10-26.md).
- **1.27.51:** logotipo institucional imprimible en fichas PDF, con fallback seguro para logos anteriores.
- **1.27.50:** planes de cobro persistidos e idempotencia por cuota. [Alcance](PROGRAMACIONES_COBRO_PERSISTIDAS_1.27.50.md).
- **1.27.49:** privacidad, biometría opcional y boletas PDF en Expo alumno.
- **1.27.48:** presupuestos Lighthouse para login móvil. [Detalle](LIGHTHOUSE_PRESUPUESTOS_1.27.48.md).
- **1.27.47:** controles axe de accesibilidad con API simulada. [Alcance](AUDITORIA_AXE_1.27.47.md).
- **1.27.46:** recorrido institucional con API y BD aisladas. [Escenario](RECORRIDO_INSTITUCIONAL_1.27.46.md).
- **1.27.45:** colores y nombre de marca vigentes en correos de activación y recuperación.
- **1.27.44:** fichas de depósito BBVA y registro manual de pagos. [Contrato](FICHAS_DEPOSITO_BBVA_1.27.44.md).
- **1.27.43:** skills locales, guía de agentes y auditoría automática. [Catálogo](AGENTES_Y_SKILLS.md).

La integración de 1.27.43–1.27.51 quedó en `main` mediante el PR #200; integrar código no acredita despliegue.

## Entregas anteriores

- **1.27.35 (PR dependiente de #181):** alumno edita datos propios de contacto en web/Expo mediante `PATCH /alumnos/me/perfil`. Importación masiva parcial acepta sólo alumnos nuevos válidos, omite duplicados, exige proveedor en cada fila y permite descargar un XLSX de correcciones con errores. Ver [flujo y auditoría](IMPORTACION_PARCIAL_Y_PERFIL_1.27.35.md).

- **1.27.34 (PR dependiente de #180):** importación masiva de alumnos con correo institucional de acceso, correo personal de contacto y selección de remitente Microsoft 365/GoDaddy por fila en Excel. Compatibilidad con CSV anterior, migración aditiva de correo personal, previsualización y confirmación transaccional conservadas. Ver [guía](CARGA_MASIVA_ALUMNOS_CORREOS.md).

- **1.27.33 (PR):** correo dual por usuario: alumnos Microsoft 365, personal y docentes GoDaddy por defecto, selección manual en web, migraciones MySQL/SQL Server y cliente Graph sin nuevas dependencias. Activación mediante configuración segura del certificado; ver [manual de despliegue](CORREO_DUAL_GRAPH_GODADDY.md). No hay nuevas funciones ni rutas en Expo.

- **1.27.32:** web de reinscripción a **ciclo posterior** para Control Escolar y Finanzas: expediente recuperado, plan compatible, retroceso/salto con motivo, previsualización de cargos, ajuste financiero de colegiatura y confirmación usando apertura/grupos existentes. Dentro del mismo ciclo permanece bloqueado hasta migración por periodo. Finanzas incorpora seguimiento paginado de alumnos con saldo, acceso telefónico y WhatsApp **manual**, previsualización de avisos de correo mediante SMTP/cola existente y KPIs por alumno; serie mensual alterna barras y líneas, importes y pagadores. Sin nuevos proveedores, migraciones ni mensajería por teléfono/WhatsApp automática. [Contrato y límites](FINANZAS_REINSCRIPCION_COBRANZA_1.27.32.md). **Pendiente CI/UAT antes de producción.**

- **1.27.31:** búsqueda por matrícula, nombre, apellidos o nombre completo (incluido segundo nombre en el campo existente); FINANZAS dispone de sugerencias opcionales de cargos adicionales por nivel, sin tarifas precargadas, con clave opcional de idempotencia para proteger reintentos del mismo actor. [Contrato de reinscripción por periodo](https://github.com/Marcor360/Sistema-Escolar/blob/c10da9ab884404bebfd439c336ff92f197392da5/docs/REINSCRIPCION_PERIODOS_Y_CARGOS_CONTRATO.md): diseño pendiente de autorización, **sin crear todavía un nuevo flujo de reinscripción ni migraciones**; Expo sin funciones de gestión.

- **1.27.30:** navegación responsive web: menú lateral a la derecha con botón hamburguesa a la derecha, fondo atenuado semitransparente que conserva visible la pantalla y corrección de la superposición de reglas genéricas para botones. Prueba E2E de alineación, fondo y contenido subyacente; sin cambios a Expo, roles o API.

- **1.27.29:** Superadmin modifica mensaje público de bienvenida y tamaño del logo en web; API con validaciones y migraciones espejo MySQL/SQL Server. Sin administración en la aplicación Expo.

- **1.27.28:** vista «Mi cuenta» con identificador, nombre, correo, teléfono, roles, estado y seguridad consultados de `/auth/me`; lectura privada y controles de recarga, recorrido y cambio de contraseña. Sin modificación de cuentas ni migraciones.

- **1.27.27:** recorrido de bienvenida según áreas autorizadas para cada rol web, con omitir, siguiente, finalizar y «Ver recorrido»; recordatorio por cuenta/navegador con localStorage, sin tokens ni nueva lógica de permisos.

- **1.27.26:** reflujo para monitores grandes, logotipo institucional más visible y acciones de usuarios separadas sin superponerse; sin nuevas dependencias ni migraciones.

- **1.27.24:** contrato de diseño preparatorio del módulo de cuentas por pagar. No agrega endpoints, tablas ni recordatorios; requiere aprobación financiera. [Contrato](CUENTAS_POR_PAGAR_CONTRATO.md).

- **1.27.23:** programación opcional, apagada por defecto, de avisos a cartera efectivamente vencida el día 3 y recargos elegibles del 10% desde el día 4. Exige actor FINANZAS vigente, planteles autorizados y SMTP. No se altera el vencimiento por defecto día 5; nada se activa sin aprobación institucional.

- **1.27.22:** gráfica de seis meses de ingresos confirmados para FINANZAS al abrir el panel, filtrada por plantel de origen; sin nuevas dependencias ni migraciones.

- **1.27.21:** reportes privados de estado de cuenta PDF y bajas actuales XLSX; sin cambios a recargos, mensajería automática, motor de cobros ni base de datos. [Alcance financiero](FINANZAS_REQUERIMIENTOS_2026-10-22.md).

- **1.27.20:** contrato técnico propuesto para la versión objetivo 1.28.0: cuatro parciales, NP y asistencia informativa, transición histórica y permisos. Sin cambio de notas ni migraciones; requiere aprobación institucional. Actualiza Vitest para resolver avisos de seguridad en pruebas. [Anexo y límites](https://github.com/Marcor360/Sistema-Escolar/blob/c10da9ab884404bebfd439c336ff92f197392da5/docs/IMPLEMENTACION_EVALUACIONES_1.28.0.md).
- **1.27.19:** limpieza documental: se retiran doce resúmenes/inventarios históricos recuperables en Git, se simplifican índice y estado y se actualizan contratos de referencia. Sin cambios funcionales ni migraciones.
- **1.27.18:** Web admite PNG/JPG/WebP de hasta 20 MiB, convierte en el navegador a WebP de hasta 10 MiB y verifica lectura pública tras cargar. API admite solo WebP optimizado, almacena temporalmente fuera de la ruta pública y protege la referencia anterior en fallos. Identidad pública sincronizada entre pestañas web y al volver a primer plano o cada minuto activo en Expo; web conserva marca válida en localStorage, Expo en SecureStore, metadatos sin caché HTTP y logos únicos con caché inmutable. IIS exige límite efectivo ≥11 MiB y UAT de archivos/ACL; sin migraciones.

Resumen histórico trasladado del README en 1.27.40; las referencias a PR pendientes y resultados describen su corte original. Para el estado consolidado consultar [Estado de implementación](ESTADO_IMPLEMENTACION.md).
