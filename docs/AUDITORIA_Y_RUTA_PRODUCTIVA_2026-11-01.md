# Diagnóstico, auditoría y ruta productiva · 1/nov/2026

Base revisada: main `39a6a31d5afa732ff2defb275b349d5fe31f1117`, 1.35.13.
Correcciones preparadas como candidata 1.35.14. El informe no acredita despliegue,
aceptación institucional, pentest externo ni revisión manual exhaustiva de cada
línea. No se usaron datos institucionales, cuentas reales ni proveedores de correo/pago.

## Estado del producto

**Beta funcional avanzada; candidata a un piloto controlado.** No es necesario
añadir otro gran módulo para llamarla beta. Hay API NestJS, administrativo React,
cliente alumno Expo nativo/web, autenticación con sesiones revocables, permisos
por rol/plantel, académico, cartera/pagos, documentos, avisos, importaciones y
migraciones MySQL/SQL Server. La base tiene 71 entidades y el chequeo de consistencia
contrasta 353 consultas cliente con 356 rutas API; esos conteos no son medidas de
cobertura ni de calidad.

La integración anterior aprobó CI, axe y Lighthouse, con pruebas locales de
620 backend, 285 web y 147 Expo. La matriz institucional tenía 67 escenarios
pendientes de evidencia de esta candidata; 1.35.14 incorpora el ensayo operativo
UAT-68. Los campos pendientes de la matriz no anulan las confirmaciones del
solicitante sobre Android, correo y permisos: esas confirmaciones son anteriores
y no certifican iOS, restore ni cada cambio de esta versión.

El código está más avanzado que la evidencia operativa. No se comprobó aquí la
versión actualmente servida por IIS, RPO/RTO real, recepción externa de avisos,
antivirus real, acceso físico Android/iOS ni aceptación por usuarios de cada sede.

## Alcance del recorrido

Barrido estático de backend/src, web/src, mobile/src, scripts, workflows y contratos
de despliegue; inventario de archivos/patrones, configuración, tipos, pruebas y
auditoría de dependencias. Revisión profunda de guards/sesiones, ScopeService,
archivos firmados, Openpay/órdenes, importaciones, workers de correo y actualización
Windows/IIS y el ETL Python. Se contrastó con los tests existentes y se añadieron regresiones.
Un barrido estático y una suite verde no demuestran ausencia total de errores.

| Área | Evidencia revisada | Límite práctico |
| --- | --- | --- |
| Acceso y permisos | JWT valida usuario/sesión/versión; roles y scope en servidor; pruebas negativas existentes | No pentest contra host institucional |
| Alumno web/nativo | Sesión web HttpOnly, caché por identidad, validación de enlaces y guard | Pruebas físicas pendientes |
| Finanzas | Transacciones, unicidad, webhook contrastado con orden/importe/divisa y proveedor | Conciliación/pasarela real pendiente |
| Archivos | Firmas de contenido, rutas privadas, tokens por recurso/sesión y no-store | ACL/ClamAV/restore reales pendientes |
| Base | Manifest, entidades, migraciones espejo y chequeos de metadata | No se intervino una base histórica |
| Operación | Scripts reales, recuperación, fuente/versiones y workflow manual | Ensayo IIS/NSSM real pendiente |

## Hallazgos corregidos

| ID | Prioridad | Evidencia y escenario | Corrección / prueba |
| --- | --- | --- | --- |
| H01 | Media | auth-correo-eventos.service.ts: un worker muere tras reclamar el intento 5; la selección exige intentos < 5 y deja PROCESANDO para siempre | Transición atómica a FALLIDO solo con lease vencido y límite agotado. Regresión con último intento vencido, lease vigente y penúltimo recuperable en la suite de ambos motores |
| H02 | Media condicional | jwt-auth.guard.ts restringía consentimiento solo en MOVIL; el alumno WEB podía llamar recursos protegidos aun con la función habilitada y aceptación pendiente | Misma comprobación para ALUMNO WEB/MOVIL; pruebas de rechazo, excepciones y acceso sin pendiente. Se conserva la función deshabilitada por defecto |
| H03 | Alta operativa | Deploy-Staging.ps1 no contrastaba Version con package.json antes de preparar/detener; una etiqueta incorrecta terminaba en fallo de health y rollback evitable | Rechazo temprano de versión backend/web; el coordinador valida además mobile/app.json y checkout limpio |
| H04 | Alta operativa | El catch del runner reiniciaba la API anterior incluso tras DDL parcialmente aplicado | Reinicio solo si falla la consulta previa al DDL; fallo de migración mantiene servicio detenido y exige inspección. Prueba ejecuta el bloque real con comandos/servicio simulados |
| H05 | Media operativa | El proxy del Portal Alumno fijaba 3000 aunque PORT de la API fuera otro | Puerto leído del entorno protegido, validado y pasado al módulo; solo se modifica la copia de release; prueba puerto 3100 y fallback SPA |
| H06 | Media operativa | Publicación separada y verificaciones públicas no acreditan por sí solas que el sitio IIS corresponda al root esperado | Coordinador comprueba sitio/ruta antes de actualizar sistema; orden y fallo parcial probados |

No se confirmó en las rutas revisadas una nueva vulnerabilidad crítica de acceso
a expedientes o cobro. Eso no sustituye una auditoría independiente ni equivale
a declarar seguro todo el repositorio. Los riesgos de entorno y de nuevas
dependencias requieren seguimiento continuo.

## Hallazgo pendiente de configuración externa

**H07, alta operativa: main sin protección efectiva.** En la consulta de solo
lectura de 1/nov/2026, GitHub devolvió HTTP 200 con `protected=false` para
`branches/main` y lista vacía para `rules/branches/main`. Los tests de la política
no configuran esas reglas. Antes de promover a producción: exigir CI vigente,
revisión independiente, bloquear force-push/borrado y verificar la política
real sin excepciones administrativas. El seguimiento #158 ya identificaba esta
necesidad; ahora se registra como puerta `main_protegida` pendiente en el control
de release. No se cambió la configuración del repositorio ni se acreditó su cierre.

## Actualización simplificada

`Update-Staging.ps1` concentra configuración pública sin credenciales, deriva la
versión y ofrece Todo/Sistema/PortalAlumno, planificación sin activación y bloqueo
exclusivo. Se conserva la separación de infraestructura y cuenta de backup. El
workflow manual exige SHA en main con CI aprobada. [Procedimiento](ACTUALIZACION_INTEGRAL_1.35.14.md).

Límites explícitos: no auto-publica tiendas nativas; no habilita producción; el
respaldo del sistema automatizado sigue siendo MySQL; SQL Server necesita su
procedimiento operativo. Un fallo después de migración no permite prometer
rollback transaccional de todo el sistema. Releases existentes no se sobrescriben.

## Camino más rápido a producción

Congelar nuevas funciones, elegir una candidata y un plantel piloto, y cerrar
estas puertas con evidencia, responsables y el SHA servido:

1. **Gobierno y operación:** proteger main y acreditar CI/revisión efectiva; comprobar versión real/host, almacenamiento, TLS, ACL, cuenta de
   servicio, antivirus y monitoreo. Ensayar actualización completa y fallo parcial.
2. **Recuperación:** restaurar BD y uploads en un entorno aislado, comprobar
   integridad y medir RPO/RTO. Tener rollback de código y recuperación de DDL separados.
3. **UAT priorizada:** alta/activación/recuperación, aislamiento por sede, inscripción,
   captura/cierre de notas, cartera/pagos/reintentos, boletas/archivos y avisos.
   Validar roles combinados y negaciones, no solo el recorrido feliz.
4. **Piloto:** grupo acotado con responsables reales, soporte y registro de incidentes;
   ensayar carga representativa. Confirmar proveedores externos solo en sandbox o
   con autorización operativa. Promover gradualmente después de aceptar el piloto.

Añadiría primero alertas accionables de fallos de cola y readiness, inventario de
versiones/compatibilidad cliente, paquetes de release generados por CI con hash y
evidencia de restore. No priorizaría WhatsApp, nuevos módulos o microservicios
para acelerar esta salida. MFA para personal privilegiado merece una siguiente
entrega con recuperación diseñada, no una implementación apresurada.

Ventana orientativa: 2–4 semanas para un piloto y promoción inicial si ya hay
operador, QA, documentos, datos de prueba y responsables disponibles; 4–8 semanas
si hay que preparar infraestructura, varios planteles o distribución iOS. No es
un compromiso de fecha: un restore fallido o UAT rechazado bloquea la promoción.

## Estimación del valor del proyecto

Estimación de **costo de reposición del software**, en MXN, sin IVA, infraestructura,
licencias, datos legados, soporte recurrente ni costo de oportunidad. No es una
tasación comercial ni una medición de horas históricas efectivamente invertidas.
Las tarifas son supuestos de planificación, no un estudio de mercado actualizado.

| Trabajo estimado para reconstruir el alcance | Horas |
| --- | ---: |
| Descubrimiento, reglas y diseño | 180–320 |
| Backend académico, usuarios y alcance | 550–1,000 |
| Finanzas e integración de pagos | 360–700 |
| Autenticación, archivos, correo y privacidad | 280–500 |
| Administrativo web y UX | 300–550 |
| Expo nativo y Portal Alumno | 220–420 |
| QA, dual DB, operación y documentación | 310–710 |
| **Total** | **2,200–4,200** |

A $650–1,100 MXN/h, la multiplicación de extremos da aproximadamente **$1.43–4.62
millones MXN**; rango ejecutivo redondeado **$1.5–4.5 millones MXN**. Un escenario
intermedio de 3,200 horas a $850/h da $2.72 millones. Son unos 14–26 meses-persona
de 160 horas; no son meses de calendario de un equipo en paralelo.

El precio de venta puede ser muy distinto. Para valorarlo como negocio faltan
clientes/ingresos, retención, exclusividad, derechos de propiedad, licencias de
terceros, contratos, garantías, costo de soporte y evidencia de operación. La
rapidez de generación con IA no convierte por sí sola líneas de código en valor
comercial. No se puede dar aquí un múltiplo de ingresos ni un precio firme de venta.

## Validación y estado de entrega

En este corte local, backend lint/typecheck/test/build aprobados (632 pruebas) y
auditoría npm sin avisos en backend, web y mobile. También pasaron 285 pruebas web, 147 Expo, sus comprobaciones de tipos/lint pertinentes y el build web. Las pruebas PowerShell ejecutan
planificación, contrato del portal y bloques de migración/rollback con dobles;
también prueban exclusión y códigos nativos de la entrada real del coordinador.
La ejecución dirigida en bases desechables y CI del commit de entrega se documentan
en el PR; no se confunden con los resultados de la base 1.35.13 ni con un ensayo IIS.

La propuesta queda en rama/PR revisable. No se disparó el workflow de despliegue,
no se activó consentimiento institucional y no se realizaron cobros, envíos ni
migraciones sobre instalaciones institucionales.

La regresión dirigida H01 pasó en MySQL y en SQL Server: 1 caso aprobado y 134 omitidos en cada ejecución dirigida, sobre contenedores desechables. No equivale a ejecutar localmente los 135 casos completos. Las siete pruebas ETL con dobles pasaron. La batería Windows general contiene pruebas de junction específicas de Windows y no pasó completa en Linux; las pruebas dirigidas de despliegue/actualizador sí pasaron localmente y la batería general debe validarse en el job Windows de CI.

El ETL continúa siendo parcial: solo planteles/alumnos, extracción de referencia y validación TLS del destino no explicitada como en la API. No se recomienda aplicarlo a datos reales sin revisar conectividad, mapeos, conciliación y recuperación. No se ejecutó contra ningún origen legado.
