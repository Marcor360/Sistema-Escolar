# Estado de implementación

Este documento distingue código presente de operación real. “Implementado” indica que existe flujo en el repositorio; no implica aceptación institucional, prueba en producción o disponibilidad de credenciales.

| Área | Estado actual | Qué falta para cerrarla |
|---|---|---|
| Autenticación y roles | Implementado en API y clientes | Pruebas integrales de permisos y decisión de endurecimiento de sesiones para despliegue |
| Planteles y alcance | Implementado con `ScopeService` en servidor | Probar combinaciones reales de usuarios y asignaciones de la institución |
| Gestión académica | Implementada: ciclos, materias, grupos, inscripciones, actividades y calificaciones | La nueva suite de integración cubre inscripción y captura; falta observar CI con MySQL y SQL Server |
| Web administrativa/docente | Pantallas principales implementadas; mensajes de error/éxito exponen regiones accesibles | Revisión con personal, auditoría completa de accesibilidad y pruebas en navegadores objetivo |
| App móvil del alumno | Inicio, materias, tareas, calificaciones, cuenta y perfil implementados; sesión vencida vuelve al acceso y acciones tienen etiquetas accesibles | Configurar y probar compilación/publicación; push y offline no están implementados |
| Archivos | Descargas con enlaces firmados y autorización en backend | Persistencia y respaldo externo para hosting; actualmente depende de disco local |
| Finanzas y Openpay | Flujos de cargo, pago y webhook implementados; pagos, recálculo y bitácora son transaccionales; webhook idempotente | Aplicar migración nueva, probar sandbox con reintentos y completar conciliación antes de producción |
| SMTP | Envío condicional implementado | Credenciales, dominio remitente, entrega y rebotes dependen del proveedor |
| Reportes | PDF y Excel implementados | Revisar formatos y datos contra formatos institucionales reales |
| Base de datos | Entidades, baselines instalables v1 y migraciones incrementales para MySQL/SQL Server; integración instala el baseline con `DB_SYNC=false` | Falta observar CI con motores reales, validar el camino de actualización desde bases históricas y aplicar migraciones aprobadas en el servidor elegido |
| ETL certweb | Carga parcial de planteles y alumnos; modo de simulación disponible | Confirmar esquema de origen, completar usuarios/docentes/grupos y probar contra ambos destinos reales |
| Producción | Variables de configuración y compilación disponibles | Hosting, dominio, TLS, respaldos, monitoreo, almacenamiento duradero y cuentas externas aún dependen de decisiones/credenciales |
| Pruebas | Unitarias y una suite HTTP con base real configurada para MySQL/SQL Server en CI | Falta observar los jobs de integración y ampliar casos de actividad/entrega y más límites de permisos |
| Privacidad y publicación | No se completa desde el código | Textos legales, aviso institucional, cuentas de tiendas y aprobación del cliente |

## Dependencias del cliente o del entorno

- Esquema sanitizado o acceso de solo lectura a certweb para fijar el mapeo ETL real.
- Motor/hosting definitivo y acceso controlado a la base destino.
- Credenciales SMTP y Openpay sandbox/producción.
- Dominios, certificados, proveedor de despliegue y política de respaldos.
- Identidad institucional, aviso de privacidad y textos legales aprobados.
- Cuentas Apple Developer y Google Play Console si se distribuirá la app.

## Verificación conocida

La suite unitaria del backend pasó después de esta revisión (18 suites, 65 pruebas), junto con lint y typecheck. El archivo de integración también compila y Jest lo descubre. La suite HTTP instala el baseline versionado y ejercita autenticación, alcance por plantel, operaciones académicas, generación concurrente de colegiaturas, pagos, descarga firmada y reintentos de Openpay; aquí no pudo ejecutarse porque los puertos locales MySQL (3306) y SQL Server (1433) no están disponibles. La ejecución real del baseline contra ambos motores queda configurada en los jobs de CI.
