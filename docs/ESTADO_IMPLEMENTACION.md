# Estado de implementación

Este documento distingue código presente de operación real. “Implementado” indica que existe flujo en el repositorio; no implica aceptación institucional, prueba en producción o disponibilidad de credenciales.

| Área | Estado actual | Qué falta para cerrarla |
|---|---|---|
| Autenticación y roles | Login, `GET /auth/me`, logout global y cambio/recuperación de contraseña en API y clientes | Pruebas integrales de permisos; access corto, refresh rotativo y sesiones por dispositivo; retirar el token web de `localStorage` |
| Planteles y alcance | Implementado con `ScopeService` en servidor | Probar combinaciones reales de usuarios y asignaciones de la institución |
| Gestión académica | Ciclos, materias, grupos, inscripciones, actividades, reentregas, calificaciones, cierre/reapertura de periodos e historial; integración del commit `b5612c0` verde en ambos motores | Acordar reglas institucionales de reapertura y reentrega; aceptación con datos reales |
| Web administrativa/docente | Pantallas principales implementadas; navegación por teclado, foco, regiones de estado/error, pestañas accesibles y manejo de errores de carga | Revisión con personal, auditoría completa de accesibilidad y pruebas en navegadores objetivo |
| App móvil del alumno | Expo SDK 57 / React Native 0.86.3; inicio, materias, tareas, calificaciones, cuenta y perfil; error y reintento de red; exportaciones JS Android/iOS locales | Build EAS firmado, pruebas físicas de red/archivos y publicación; push y caché offline no implementados |
| Archivos | Descargas con enlaces firmados y autorización en backend | Persistencia y respaldo externo para hosting; actualmente depende de disco local |
| Finanzas y Openpay | Cargo, pago manual idempotente, órdenes/webhook y bitácora transaccionales | Aplicar migraciones incrementales en staging, certificar sandbox/reintentos y proceso de conciliación antes de producción |
| SMTP | Envío condicional implementado | Credenciales, dominio remitente, entrega y rebotes dependen del proveedor |
| Reportes | PDF y Excel implementados | Revisar formatos y datos contra formatos institucionales reales |
| Base de datos | Entidades, baselines instalables v1, runner manual con bloqueo por base y migraciones incrementales para MySQL/SQL Server; CI prueba adopción, migración y dos procesos `up` sobre bases aisladas con `DB_SYNC=false` | Validar actualización desde bases históricas y aplicar migraciones aprobadas en el servidor elegido; el DDL de MySQL puede requerir reparación manual tras fallos parciales |
| ETL certweb | Carga parcial de planteles y alumnos; modo de simulación disponible | Confirmar esquema de origen, completar usuarios/docentes/grupos y probar contra ambos destinos reales |
| Producción | Variables de configuración y compilación disponibles | Hosting, dominio, TLS, respaldos, monitoreo, almacenamiento duradero y cuentas externas aún dependen de decisiones/credenciales |
| Pruebas | Local: 124 backend, 8 web, 4 móviles y 3 ETL; lint, typecheck y builds/exportaciones pasan. CI de `b5612c0` pasó integración HTTP en MySQL y SQL Server aislados | Ejecutar CI del árbol actual; pruebas en dispositivos, VPS y cuentas institucionales por rol/plantel |
| Privacidad y publicación | No se completa desde el código | Textos legales, aviso institucional, cuentas de tiendas y aprobación del cliente |

## Dependencias del cliente o del entorno

- Esquema sanitizado o acceso de solo lectura a certweb para fijar el mapeo ETL real.
- Motor/hosting definitivo y acceso controlado a la base destino.
- Credenciales SMTP y Openpay sandbox/producción.
- Dominios, certificados, proveedor de despliegue y política de respaldos.
- Identidad institucional, aviso de privacidad y textos legales aprobados.
- Cuentas Apple Developer y Google Play Console si se distribuirá la app.

## Verificación conocida

La última CI publicada del commit `b5612c0` ([run `37407826286`](https://github.com/Marcor360/Sistema-Escolar/actions/runs/37407826286)) terminó verde en backend, web, móvil, ETL, scripts Windows e integración HTTP MySQL/SQL Server con bases aisladas y `DB_SYNC=false`. Es evidencia de ese commit; los cambios locales posteriores aún no tienen una ejecución remota propia.

La suite HTTP instala un baseline versionado y cubre autenticación, alcance por plantel, operaciones académicas, pagos, descargas firmadas, webhook, cierre de periodos y reentrega. No se ejecutó con los cambios locales actuales: requiere `RUN_DB_INTEGRATION=1` y una base aislada; el motor Docker local no está activo. El typecheck de backend sí incluye ahora `test/critical-flows.integration-spec.ts`.

Limitaciones restantes: la migración de unicidad de grupos por ciclo/plantel/nombre y el runner manual `db:migrate` se ejercitan en CI sobre bases aisladas, pero no se ha ensayado la actualización de una base institucional histórica. El runner no deduce historiales antiguos; ante fallo DDL parcial en MySQL se inspecciona el esquema antes de reparar y reintentar. La aceptación visual/accesible final y pruebas con credenciales Openpay sandbox requieren el entorno y los responsables correspondientes.
