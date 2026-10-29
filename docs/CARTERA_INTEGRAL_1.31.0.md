# Apertura de cartera y alta de alumnos — candidata 1.31.0

Solicitud institucional de 29/oct/2026. Implementado en código; no implica despliegue, aceptación UAT ni creación de buzones en Microsoft 365/GoDaddy.

## Operación

- Apertura ofrece **Crear alumno y cartera** o **Asignar cartera a alumno existente**. El segundo buscador solo incluye alumnos activos del plantel sin aperturas anteriores ni reinscripciones vigentes. La API repite la validación; no basta el filtro web.
- Control Escolar/SUPERADMIN confirma el alta conjunta en una transacción. Si falla identidad, grupo o generación de cargos, se revierte todo. Un UUID estable permite repetir la confirmación sin duplicar alumno, cartera ni cuotas.
- El nuevo expediente conserva usuario/rol ALUMNO con `email=NULL`, activación pendiente y contraseña aleatoria inaccesible. No usa direcciones ficticias y no encola invitaciones. El correo personal es solo contacto.
- Usuarios permite filtrar **alumnos sin correo institucional**. Control Escolar/SUPERADMIN del plantel asigna correo institucional y proveedor. Tras commit se solicita la activación en el outbox existente. Repetir la misma asignación pendiente permite recuperar una falla de encolado, sin cambiar correo ni duplicar la invitación vigente. No se sustituye una dirección ya asignada desde esta acción. El código y la contraseña los gestiona el titular.
- Crear el expediente no crea un buzón: la dirección debe existir en el proveedor institucional. Las cuentas anteriores conservan su correo y sus flujos de activación.

## Total, cuotas y pagos

La apertura captura total contractual y calendario explícito (concepto, importe, mes y vencimiento). La suma en centavos debe coincidir exactamente con el total. Se generan únicamente las cuotas, nunca otro cargo por el total. No se repite colegiatura del mismo mes ni concepto/mes; fechas dentro del periodo académico configurado, con ventana del ciclo como respaldo para periodos históricos sin fechas.

Las tarifas de catálogo se mantienen disponibles a Control Escolar. Solo una cuenta con FINANZAS/SUPERADMIN puede confirmar importes diferentes al catálogo; para confirmar la inscripción también requiere ADMINISTRATIVO/SUPERADMIN. Las becas y descuentos siguen sus mecanismos financieros existentes. Confirmar una cartera no acredita pagos. Al asignar un alumno existente se muestran sus pagos anteriores; un cargo previo compatible del mismo plantel/ciclo/concepto/mes, importe y vencimiento se vincula sin duplicarlo ni modificar pagos, descuentos o recargos. Una incompatibilidad exige conciliación de Finanzas.

El detalle de cartera y la trayectoria de reinscripción muestran cuotas congeladas, cargos, pagos confirmados y saldo real del plantel autorizado. Finanzas y la app reutilizan los cargos/pagos existentes; no se copian pagos ni se recotiza el historial. La unicidad ordinaria alumno/ciclo anterior permanece. Continuar otros periodos utiliza Reinscribir alumno.

## Pausa

**Sin grupo: pausa / baja temporal sin cobros** es la opción inicial. Conserva contexto, total y cuotas, sin inscripción nueva, cargos ni solicitud susceptible de agrupación automática. Si se solicita asignación y no se obtiene grupo, también queda en PAUSA; una solicitud existente pasa a PAUSA y queda fuera de las cohortes automáticas.

La pausa describe la nueva cartera, no borra ni da de baja inscripciones o cargos históricos del alumno. No suspende automáticamente su cuenta. Reanudar requiere Control Escolar, motivo y confirmación; permite grupo compatible explícito o intento automático. Se comprueba contexto y calendario. Sin grupo sigue pausada; con grupo se generan todas sus cuotas una sola vez con los precios congelados. Reintentar sobre una cartera abierta devuelve su estado sin duplicar cargos.

Las aperturas anteriores conservan sus estados PENDIENTE/ABIERTA y sus reglas históricas. La candidata no convierte ni cobra retroactivamente esas operaciones.

## Identidad y migración

- CURP normalizada y única globalmente, incluyendo expedientes archivados; comprobar al crear/corregir/importar y mediante índice único para solicitudes concurrentes. Corregir CURP exige formato válido y no permite vaciar la identidad existente.
- `migracion_cartera_integral.sql`, espejo MySQL/SQL Server, agrega contexto nullable de cartera, estado PAUSA y unicidad de CURP; permite correo nullable. En SQL Server sustituye solo la restricción única de email por índice filtrado para admitir varios NULL. No elimina tablas, filas, cargos ni pagos.
- Precondición: revisar CURP duplicadas y vacías existentes sin fusionar automáticamente. El índice aborta ante duplicados. Consultas de diagnóstico: `SELECT curp,COUNT(*) FROM alumnos WHERE curp IS NOT NULL GROUP BY curp HAVING COUNT(*)>1` (ejecutar solo en el ambiente autorizado; no incluir resultados personales en reportes).
- Aplicar con runner, respaldo/restore ensayado y backend/web coordinados. Un rollback del código no revierte DDL; las cuentas sin correo requieren esta versión. No se aplicó la migración en sistemas institucionales.

## Contratos y evidencia

- GET `/cartera/alumnos-elegibles`; POST `/cartera/integral/previsualizar`, `/integral/confirmar`; POST `/cartera/:id/reanudar`.
- GET `/usuarios/listado?tipo=ALUMNO&sinCorreo=true`; POST `/usuarios/alumnos/:id/correo-institucional`.
- `CarteraService`: cotización, commit de identidad/apertura/cuotas y reanudación; `UsuariosService.asignarCorreoAlumno`: locks, alcance, exclusividad y auditoría; `resumenCarteraAlumno`: pagos confirmados por plantel histórico.
- Pruebas de contrato y UI, regresiones de backend/web/móvil y recorridos de integración con migrador en bases desechables. Los resultados concretos se documentan al completar validación local; CI por SHA, staging, recepción de correo, respaldo/restauración y UAT institucional siguen pendientes.

## Validación local de la candidata

- Backend: lint, typecheck y build aprobados; 98 suites / 557 pruebas unitarias aprobadas. Revalidación de importación parcial tras normalizar CURP: 4 pruebas aprobadas.
- Web: lint y build aprobados (URL de API ficticia para compilación); 68 archivos / 255 pruebas aprobadas. Tras ajustar la presentación de correo nullable, las 15 pruebas de Alumnos/Formulario y la compilación volvieron a pasar.
- Móvil: 11 pruebas y TypeScript aprobados; sin cambios en flujos de gestión móvil.
- MySQL 8.4: 130 pruebas de integración aprobadas; caso integral ampliado revalidado aisladamente con éxito. Migrador real, paridad nullable y concurrencia en base desechable.
- SQL Server 2022: regresión de 129 casos aprobados; el caso integral detectó una matrícula ficticia reutilizada por otro escenario. Se corrigió exclusivamente el identificador de prueba y el caso afectado pasó al repetirse (1 aprobado / 129 omitidos por filtro). El primer intento amplio perdió el contenedor por memoria; la repetición utilizó límite de memoria de SQL Server.
- Navegador Chromium: `test:responsive` aprobado con API simulada. `test:cartera` aprobado a 360, 768 y 1440 px: alta sin correo, dos cuotas, pausa, asignación posterior de correo y consulta de pagos de alumno existente. Estas pruebas de interfaz no sustituyen las transacciones con BD.
- Consistencia de versiones, migraciones espejo, rutas API y matriz UAT comprobada. Las 61 aceptaciones institucionales y las 8 puertas de liberación permanecen pendientes; no se registran pruebas locales como UAT ni CI por SHA.

No se probaron entrega real de correo, restore de una base institucional ni despliegue en IIS. No se modificó ningún sistema institucional.
