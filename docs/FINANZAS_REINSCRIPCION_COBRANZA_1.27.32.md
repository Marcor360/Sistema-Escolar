# Avance funcional 1.27.32 — reinscripción, morosidad y gráficos

**Candidata preparatoria. No constituye despliegue ni autorización de uso institucional.** Se apila sobre el PR #176 (1.27.31); integrar en orden.

## Alcance en código

### Cartera escolar > Reinscribir alumno

- Nueva ruta web para ADMINISTRATIVO `/apertura-cartera/reinscribir` y FINANZAS `/finanzas/reinscribir` (también acción desde el módulo Finanzas).
- Busca por matrícula **o** nombre completo usando el selector paginado de alumnos. Carga automáticamente el origen: estudiante, matrícula, plantel, grupo, nivel, carrera y periodo académico. No crea un nuevo usuario ni matrícula.
- Destino: selecciona ciclo **posterior**, mismo plan/nivel/tipo ANUAL, SEMESTRAL o CUATRIMESTRAL, según el catálogo real. El origen debe estar CERRADO y el destino PREPARACION; las fechas no pueden superponerse. Si el destino no es exactamente periodo N+1, se obliga a registrar motivo detallado (repetición, retroceso o salto).
- Permite seleccionar grupo compatible o agrupación automática ya implementada. Los cargos nacen solamente con grupo asignado; mientras la solicitud esté pendiente, la cartera y cotización permanecen pendientes.
- FINANZAS puede ajustar monto de un concepto de COLEGIATURA para el periodo de destino, con monto positivo y motivo. Se revisa a nivel de API y se incluye en el hash de cotización; ADMINISTRATIVO puede usar la tarifa aprobada del catálogo, **pero no modificarla**.
- Previsualiza y confirma con clave UUID única, bitácora de origen y motivo, guarda cotización congelada y opera en la transacción de cartera/agrupación existente. Conserva cargos, pagos e inscripciones de origen.

**Límite crítico que NO está resuelto:** dentro del mismo ciclo, la BD impone unicidad alumno+ciclo tanto en apertura como en solicitud y permite una sola inscripción regular activa. **No se habilitan cambios de cuatrimestre/semestre dentro del mismo ciclo**, ni se elude la restricción con bajas ficticias. Para habilitarlos se requieren migraciones espejo por alumno+periodo, historificación del estado de inscripción y adecuación de reportes, boletas, pagos, recursamientos y concurrencia según el contrato de `docs/REINSCRIPCION_PERIODOS_Y_CARGOS_CONTRATO.md`. El PR no incluye esas migraciones. Si el modelo de ciclos institucionales usa un ciclo por cuatrimestre, la operación podrá hacerse entre esos ciclos una vez aprobada.

**Materias pendientes:** se conserva íntegro el expediente. Por privacidad, FINANZAS no obtiene automáticamente calificaciones en su pantalla; la pantalla advierte que Control Escolar debe comprobar y autorizar materias reprobadas y recursamientos **antes** del movimiento. La asignación automática de recursamiento, seriación y reprobación todavía no se desarrolla. Este flujo no certifica aprobación de materias, grados ni autorización académica; no puede operar institucionalmente sin ese control adicional.

**Calendario de cuotas:** conserva el comportamiento de cartera de un conjunto de conceptos/mes y fecha; no construye todavía 3 o 4 mensualidades para un cuatrimestre ni el desglose total anual/semestral. FINANZAS debe cotejar la tarifa, contrato, concepto y régimen vigente. No generar colegiaturas masivas además de una obligación anual/semestral ya cubierta.

### Finanzas > Seguimiento de alumnos sin pago

- Se agrega endpoint autorizado `GET /finanzas/cobranza/pendientes` con plantel obligatorio, paginación, filtro vencidos/por vencer y filtro sin abono. Se agrupan cargos abiertos **por alumno**, usando pagos confirmados aplicados al cargo. Se devuelve teléfono/correo solo al rol FINANZAS y dentro de sus planteles.
- Se diferencia «sin abono en cargos abiertos» de «sin pagos en toda su historia». No equiparar vencido con simplemente pendiente: fecha de vencimiento anterior al día local de México.
- Botones manuales `tel:` y `wa.me` con texto genérico; **no** ejecutan llamadas ni envíos automáticos, ni envían el saldo al tercero. Exigen que el empleado verifique autorización/aviso de privacidad. Falta captura de consentimiento por canal y número verificado.
- Correo masivo se conecta a `/finanzas/preview-cobranza` y `/finanzas/avisos-cobranza`: **ya existen** cola SMTP, deduplicación y seguimiento de estado. La confirmación aclara que afecta **todos los alumnos con saldo del plantel**, no solo las filas de la tabla ni el filtro «sin abono». Programado ≠ entregado.
- Los envíos automáticos programados el día 3 ya existen en 1.27.23 detrás de `COBRANZA_DIA3_HABILITADA=false`, con FINANZAS_AUTO_ACTOR_ID y SMTP reales. **No se activan en este PR**; legal, política de cobranza y UAT deben aprobarlos.

Para **llamadas y WhatsApp automatizados**, falta seleccionar proveedor oficial (telefonía/SIP, WhatsApp Business Platform), registrar consentimiento/opt-out verificable, plantillas aprobadas, política de reintento/idempotencia, teléfono E.164 validado, credenciales privadas, límites de frecuencia, costos, auditoría y reconciliación de estados. No se simula entrega ni se utiliza WhatsApp Web no oficial.

### Finanzas > Indicadores y Dashboard

- `/reportes/resumen` añade `alumnosConSaldo`, `alumnosSinAbono`, `alumnosConAbonoParcial` y `alumnosConVencidos`; distingue alumno de cargo. Las métricas sólo se muestran a rol financiero/administración autorizada.
- `/reportes/cobranza/serie` devuelve tanto `cobrado` como `alumnosQuePagaron` (DISTINCT por mes, pagos CONFIRMADO y plantel de origen). No se contabilizan pagos rechazados.
- Gráfico configurable **barras/líneas** y **MXN/alumnos**, SVG responsive, descripción accesible y tabla de valores exactos, sin dependencias nuevas.
- La sección «Indicadores de cobranza» de Finanzas y el dashboard para FINANZAS presentan los KPI y gráfica con filtros por plantel.

## Pruebas y autorización antes de merge

1. Lint, typecheck, build y tests de backend/web en CI, además de cumplimiento de versiones entre 3 workspaces.
2. Pruebas de contratos por rol y plantel: FINANZAS modifica precio, ADMINISTRATIVO no, ALUMNO ni MAESTRO no ejecutan reinscripción ni pueden ver contactos.
3. Ciclo cerrado → preparación posterior; retroceso N→N-1 exige motivo, grupo lleno deja solicitud pendiente, reintentos no duplican apertura/cargo, pagos anteriores intactos.
4. Morosidad con cargos pagados, cancelados, sin vencimiento, parciales, con cuota futura; no contactar bajas y no enviar deudas ajenas.
5. Dos motores MySQL/SQL Server, concurrencia real y UAT con alumnos ficticios; probar que los roles no ven datos de otro plantel.
6. Proveedor SMTP real/consentimiento comprobado y estados ENVIADO, INCIERTO, ERROR, reintentos manuales; **no habilitar envíos masivos reales en datos institucionales sin aprobación**.
7. Revisión legal: acuerdo DOF del 10/mar/1992, artículo sobre los primeros diez días sin cargo para niveles alcanzados. No activar penalización al día 4 sin dictamen.
8. UX en pantallas grandes y móviles web, teclado, mensajes de carga, validación de campos y conexión intermitente.

## Revisión legal/privacidad

- Acuerdo DOF 10/03/1992: https://sidof.segob.gob.mx/notas/docFuente/4655028
- LFPDPPP 2025, finalidades y consentimiento en datos patrimoniales: https://sidof.segob.gob.mx/notas/docFuente/5752569
- Meta WhatsApp Business Messaging Policy, plantillas oficiales para contacto proactivo: https://business.whatsapp.com/policy/preview?lang=es_LA

**Alcance por plataforma:** web ADMINISTRATIVO/FINANZAS, API NestJS; app Expo ALUMNO sin nuevas pantallas de gestión, sin notificaciones automáticas por estos cambios. **No hay migraciones ni nuevas dependencias.**
