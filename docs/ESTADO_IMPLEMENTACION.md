# Estado de implementación

Este documento distingue código presente de operación real. “Implementado” indica que existe flujo en el repositorio; no implica aceptación institucional, prueba en producción o disponibilidad de credenciales.

| Área | Estado actual | Qué falta para cerrarla |
|---|---|---|
| Autenticación y roles | Implementado en API y clientes | Pruebas integrales de permisos y decisión de endurecimiento de sesiones para despliegue |
| Planteles y alcance | Implementado con `ScopeService` en servidor | Probar combinaciones reales de usuarios y asignaciones de la institución |
| Gestión académica | Implementada: ciclos, materias, grupos, inscripciones, actividades y calificaciones; integración verde en ambos motores | Ejecutar en CI el nuevo caso concurrente de activación y ampliar flujos de entrega/actividad |
| Web administrativa/docente | Pantallas principales implementadas; navegación por teclado, foco, regiones de estado/error, pestañas accesibles y manejo de errores de carga | Revisión con personal, auditoría completa de accesibilidad y pruebas en navegadores objetivo |
| App móvil del alumno | Inicio, materias, tareas, calificaciones, cuenta y perfil implementados; las pantallas de datos muestran error y reintento; sesión vencida vuelve al acceso | Configurar y probar compilación/publicación; push y offline no están implementados |
| Archivos | Descargas con enlaces firmados y autorización en backend | Persistencia y respaldo externo para hosting; actualmente depende de disco local |
| Finanzas y Openpay | Flujos de cargo, pago y webhook implementados; pagos, recálculo y bitácora son transaccionales; webhook idempotente | Aplicar migración nueva, probar sandbox con reintentos y completar conciliación antes de producción |
| SMTP | Envío condicional implementado | Credenciales, dominio remitente, entrega y rebotes dependen del proveedor |
| Reportes | PDF y Excel implementados | Revisar formatos y datos contra formatos institucionales reales |
| Base de datos | Entidades, baselines instalables v1, runner manual y migraciones incrementales para MySQL/SQL Server; CI prueba adopción y migración desde baseline aislado con `DB_SYNC=false` | Validar actualización desde bases históricas y aplicar migraciones aprobadas en el servidor elegido; el runner no tiene rollback y requiere una sola ejecución a la vez |
| ETL certweb | Carga parcial de planteles y alumnos; modo de simulación disponible | Confirmar esquema de origen, completar usuarios/docentes/grupos y probar contra ambos destinos reales |
| Producción | Variables de configuración y compilación disponibles | Hosting, dominio, TLS, respaldos, monitoreo, almacenamiento duradero y cuentas externas aún dependen de decisiones/credenciales |
| Pruebas | 109 unitarias backend, 5 web, 2 móviles, 3 ETL y suite HTTP verde en MySQL/SQL Server en CI | Ejecutar en CI el nuevo caso HTTP de concurrencia de ciclos; ampliar flujos de actividad/entrega y límites de permisos |
| Privacidad y publicación | No se completa desde el código | Textos legales, aviso institucional, cuentas de tiendas y aprobación del cliente |

## Dependencias del cliente o del entorno

- Esquema sanitizado o acceso de solo lectura a certweb para fijar el mapeo ETL real.
- Motor/hosting definitivo y acceso controlado a la base destino.
- Credenciales SMTP y Openpay sandbox/producción.
- Dominios, certificados, proveedor de despliegue y política de respaldos.
- Identidad institucional, aviso de privacidad y textos legales aprobados.
- Cuentas Apple Developer y Google Play Console si se distribuirá la app.

## Verificación conocida

El [run `37097877896` del PR #1](https://github.com/Marcor360/Sistema-Escolar/actions/runs/37097877896), commit `88b9467`, terminó verde en Backend, Web, Mobile, ETL, integración MySQL e integración SQL Server. Backend pasó `npm ci`, auditoría completa, lint, typecheck, build y 106 pruebas; Web pasó auditoría completa, lint, 5 pruebas y build; Mobile pasó su revisión de avisos documentados, 2 pruebas, TypeScript y export Android; ETL pasó 3 pruebas. Los dos motores ejecutaron la suite HTTP con baseline aislado y `DB_SYNC=false`. La suite también ejercita `adopt`, `up` y `status` del runner sobre bases aisladas. Este run es evidencia histórica del PR; consulta Actions para el estado vigente de `main`.

La suite HTTP instala un baseline versionado y cubre autenticación, alcance por plantel, operaciones académicas, generación concurrente de colegiaturas, pagos, descarga firmada y webhooks de Openpay. La suite completa no se ejecutó localmente: requiere `RUN_DB_INTEGRATION=1` y una base aislada, y aquí no hay Docker ni servicios en 3306/1433. La ejecución remota anterior `1.8.3` falló por una expectativa incorrecta de una colegiatura total con dos alumnos inscritos; la suite corregida pasó en ambos motores en el PR #1.

Limitaciones restantes: la migración de unicidad de grupos por ciclo/plantel/nombre y el runner manual `db:migrate` se ejercitan en CI sobre bases aisladas, pero no se ha ensayado la actualización de una base institucional histórica. El runner no deduce historiales antiguos ni tiene rollback y requiere una sola ejecución a la vez; ante un fallo parcial se debe inspeccionar el esquema antes de reintentar. La aceptación visual/accesible final y pruebas con credenciales Openpay sandbox requieren el entorno y los responsables correspondientes.
