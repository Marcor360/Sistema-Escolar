# Primera candidata a beta funcional: 1.24.0-beta.1

Fecha: 13 de octubre de 2026. Base: `01b40b4c8119c72939d1f46b63efa72f7a1e2d06`. Esta etapa continúa la [auditoría integral anterior](AUDITORIA_ESTADO_1.23.5_2026-10-13.md) y realiza **30 mejoras funcionales**, sin contar pruebas ni documentación como mejoras adicionales. No cambia entidades, esquema ni migraciones.

## Escaneo y problemas encontrados

Se revisaron App, los seis destinos móviles, autenticación y cliente API, almacenamiento de marca, configuración Expo/EAS, accesibilidad, manejo de teclado, textos y operaciones sensibles; en web, navegación, ayuda por sección, conexión y selección de plantel. Se contrastaron contratos con la API y se conservaron las reglas servidor de identidad, ScopeService, sesiones, archivos y finanzas. Las conexiones con ambos motores y los recorridos web se verifican en CI sobre bases aisladas.

Problemas concretos: marca bloqueada ante fallo de SecureStore; caché sin validar; autenticación innecesaria en peticiones públicas; configuración de URL que admitía credenciales/ruta incorrecta; segundo 401 que mantenía una sesión aparente; login sin bloqueo síncrono; formularios poco adaptados a teclado y pantallas pequeñas; acciones financieras y reemplazo de entrega sin confirmación; textos poco explícitos; contraste fijo sobre colores de marca configurables; resumen web susceptible a respuestas tardías y reintentos del plantel incorrecto; respuestas internas del servidor visibles en clientes.

## Las 30 mejoras implementadas

| # | Cambio funcional | Archivo principal / verificación |
|---|---|---|
| 1 | Arranque de marca tolera fallos de lectura, borrado, escritura y red; siempre finaliza con marca válida o predeterminada | `mobile/src/marca-carga.ts`, App; regresiones de almacenamiento |
| 2 | Validación de estructura, colores y ruta local de logo antes de usar marca remota/caché | `marca-carga.ts`; marcas corruptas y rutas externas rechazadas |
| 3 | Marca y login públicos no leen ni envían token de SecureStore | Cliente móvil; prueba de almacenamiento inaccesible |
| 4 | URL API validada al empaquetar y ejecutar: /api, protocolos, entorno, sin credenciales/query/fragmento; HTTPS en preview/producción | Config móvil/Expo; pruebas runtime y Node |
| 5 | Un segundo 401 después de renovar limpia tokens y termina sesión sin bucle | Cliente móvil; prueba de rechazo definitivo |
| 6 | Login bloquea doble toque de forma síncrona y evita envío vacío | Login; prueba con promesa pendiente |
| 7 | Mostrar/ocultar contraseña, oculta inicialmente | Login; prueba de visibilidad y valor conservado |
| 8 | Login desplazable con teclado, tamaños mínimos y envío desde teclado | Login; revisión estructural, QA física pendiente |
| 9 | Logo fallido sustituido por monograma | Login; onError y fallback |
| 10 | Login explica audiencia, funciones y contacto de recuperación | Login; alumno móvil/personal web claramente diferenciados |
| 11 | Materias explica cómo abrir docente/materiales y actualizar | Cabecera de lista desplazable |
| 12 | Tareas explica adjunto, comentario y confirmación de registro | Cabecera de lista; no promete trabajo offline |
| 13 | Calificaciones explica P1–P3, pendientes y Final separado; etiqueta promedio oficial | Calificaciones; conserva cálculo en servidor |
| 14 | Reemplazar entrega requiere confirmación antes de elegir archivo | Tareas; pruebas de confirmación y cancelación del selector |
| 15 | Comentario de tarea multilinea, opcional, delimitado y con estado accesible de envío | Tareas; mantiene límite de 500 caracteres |
| 16 | Pago requiere confirmación de concepto/saldo antes de crear orden; explica confirmación del servidor | Estado de cuenta; prueba de operación diferida |
| 17 | Cambio de contraseña en Perfil exige confirmación coincidente y contraseña actual, sin autocorrección | Perfil; prueba de discrepancia |
| 18 | Cierre de sesión confirmado y protegido contra llamadas simultáneas | Perfil; pruebas de confirmación y doble toque |
| 19 | Avisos en dispositivo con explicación, controles de 44 px y bloqueo síncrono | Perfil; no altera permisos ni registro servidor |
| 20 | Texto con contraste calculado sobre colores configurables en tarjetas y botones clave | Inicio, Tareas, Perfil, EstadoCuenta; función WCAG existente |
| 21 | Indicadores de Inicio permiten envolver filas en anchos pequeños; reintentar tiene objetivo táctil suficiente | Inicio; QA nativa con fuente ampliada pendiente |
| 22 | Guía desplegable de propósito y seguridad en las 17 secciones web | Shell; prueba de explicación por ruta |
| 23 | Aviso web de conexión del dispositivo y datos potencialmente antiguos; retiro al reconectar | Shell; eventos online/offline probados |
| 24 | Resumen del panel evita respuestas de planteles anteriores; reintenta plantel actual y limpia datos al cambiar | Dashboard; prueba de carrera y reintento |
| 25 | Atajos web sin duplicados para cuentas con varios roles | Dashboard; deduplicación por ruta |
| 26 | Errores accionables para red/timeout y sanitización de respuestas 5xx; datos malformados no se renderizan como objetos | Clientes; pruebas de mensajes y detalles internos |
| 27 | Cambio inicial de contraseña con confirmación, bloqueo síncrono, campos accesibles y contenedor desplazable | CambioPasswordInicial; validación de discrepancias probada |
| 28 | App rechaza abrir pago sin HTTPS o con credenciales embebidas | EstadoCuenta; prueba de enlace inseguro tras crear orden |
| 29 | Tareas no envía un archivo si el selector termina tras salir de la cuenta/pantalla; ignora confirmaciones tardías | Tareas; prueba de desmontaje durante selección |
| 30 | Una orden de pago tardía no abre pasarela ni muestra datos después de salir de la cuenta/pantalla | EstadoCuenta; prueba de desmontaje durante petición |

Las etiquetas cortas de pestañas Notas y Cuenta mantienen títulos completos de pantalla. La marca nunca habilita acceso: autenticación y autorización siguen comprobándose en servidor. Confirmar una acción en UI no sustituye su validación ni su idempotencia en backend.

## Validación

Cambios y resultados automatizados: [PR 28 y sus ocho controles de CI](https://github.com/Marcor360/Sistema-Escolar/pull/28/checks). La aprobación se exige sobre el último SHA, incluyendo ambos motores y navegador.

- Backend: 191 pruebas en 39 suites; typecheck correcto; lint sin errores y 527 advertencias históricas.
- Web: 80 pruebas en 23 archivos; lint y compilación. Responsive Chromium entre 320 y 3840 px, con API simulada; los recorridos con API/base real se ejecutan aparte en CI.
- Móvil: 58 pruebas en diez archivos y 11 pruebas Node de configuración/auditoría; TypeScript y exportación Android Expo.
- Integración: CI exige suites MySQL y SQL Server, web-e2e, ETL y scripts Windows antes de integrar.

Las pruebas móviles usan componentes con primitivas React Native simuladas: comprueban decisiones, bloqueo, renderizado y llamadas, no el aspecto físico de Android/iOS ni teclado/lector de pantalla nativos. Las pruebas de marca ejercitan el mismo cargador usado por App; no provocan un fallo real de SecureStore del dispositivo. El aviso online/offline informa conexión del navegador, no asegura disponibilidad de la API. Los controles existentes de integridad financiera, permisos y migraciones se conservan.

## Guía de uso móvil

| Destino | Para qué sirve | Acción principal |
|---|---|---|
| Inicio | Resumen, avisos y próximos eventos | Leer avisos y actualizar deslizando |
| Materias | Clases, docente y materiales | Tocar una materia y abrir material |
| Tareas | Actividades y estado de entrega | Elegir archivo; esperar confirmación; reemplazar sólo si está permitido |
| Notas / Calificaciones | Parciales y promedio oficial | Consultar; pendientes no representan cero |
| Cuenta / Estado de cuenta | Cargos, saldo e historial | Confirmar orden y pagar en pasarela; volver y actualizar |
| Perfil | Identidad, contraseña y avisos del dispositivo | Confirmar cambio de contraseña o cierre de sesión |

Para entrar usa la cuenta ALUMNO; el personal trabaja en web. Una cuenta temporal exige cambiar contraseña antes de consultar datos. Las operaciones requieren red. No compartir contraseña; cerrar sesión en dispositivos compartidos. Si una operación financiera o entrega falla de forma incierta, actualizar su estado antes de repetirla y consultar al responsable si persiste.

## Qué falta para aceptar la primera beta

**Estado: candidata técnica a beta funcional para un piloto controlado; aceptación operativa pendiente.** El bloqueo de marca conocido está corregido en código. No se declara producción estable ni app publicada.

| Puerta de aceptación | Evidencia requerida |
|---|---|
| Staging | Desplegar el SHA aprobado con URL HTTPS real, secretos propios y esquema conciliado; comprobar API y web desde la red del piloto |
| Dispositivos | APK/IPA firmados instalados en Android/iOS físicos: 320/360/390 px equivalentes, texto ampliado, teclado, lector de pantalla, permisos, segundo plano y cambio de cuenta |
| Conectividad | Red lenta/cortada, reconexión, 401/403, sesión revocada, almacenamiento inaccesible, descargas firmadas y retorno de pasarela |
| Negocio | Aceptación de inscripción/traslado, tareas/calificaciones, cierre/promoción, cobros y permisos por responsables |
| Proveedores | SMTP/Openpay sandbox y push FCM/APNs configurados; recepción y conciliación verificadas |
| Recuperación | Respaldo y restauración aislada ensayados, monitoreo, incidencias y responsables definidos |
| Legado, si aplica | Completar ETL, TLS verificado, mapeo y conciliación antes de importar datos institucionales |

El ETL sigue siendo prototipo parcial; no forma parte del alcance aceptable de esta candidata sin esas correcciones. Persisten cuotas/antivirus por definir, checksums de migraciones por mejorar y deuda de tipado. La base de producción y proveedores no se modificaron ni certificaron. Véanse [reglas del piloto](REGLAS_PILOTO.md), [operación](OPERACION_PRODUCCION.md) y [staging](STAGING_WINDOWS_IIS.md).
