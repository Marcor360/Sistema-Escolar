# Estado de implementación

Este documento distingue código presente de operación real. “Implementado” indica que existe flujo en el repositorio; no implica aceptación institucional, prueba en producción o disponibilidad de credenciales.

| Área | Estado actual | Qué falta para cerrarla |
|---|---|---|
| Autenticación y roles | Implementado en API y clientes | Pruebas integrales de permisos y decisión de endurecimiento de sesiones para despliegue |
| Planteles y alcance | Implementado con `ScopeService` en servidor | Probar combinaciones reales de usuarios y asignaciones de la institución |
| Gestión académica | Implementada: ciclos, materias, grupos, inscripciones, actividades y calificaciones | La nueva suite de integración cubre inscripción y captura; falta observar CI con MySQL y SQL Server |
| Web administrativa/docente | Pantallas principales implementadas; navegación por teclado, foco, regiones de estado/error, pestañas accesibles y manejo de errores de carga | Revisión con personal, auditoría completa de accesibilidad y pruebas en navegadores objetivo |
| App móvil del alumno | Inicio, materias, tareas, calificaciones, cuenta y perfil implementados; las pantallas de datos muestran error y reintento; sesión vencida vuelve al acceso | Configurar y probar compilación/publicación; push y offline no están implementados |
| Archivos | Descargas con enlaces firmados y autorización en backend | Persistencia y respaldo externo para hosting; actualmente depende de disco local |
| Finanzas y Openpay | Flujos de cargo, pago y webhook implementados; pagos, recálculo y bitácora son transaccionales; webhook idempotente | Aplicar migración nueva, probar sandbox con reintentos y completar conciliación antes de producción |
| SMTP | Envío condicional implementado | Credenciales, dominio remitente, entrega y rebotes dependen del proveedor |
| Reportes | PDF y Excel implementados | Revisar formatos y datos contra formatos institucionales reales |
| Base de datos | Entidades, baselines instalables v1 y migraciones incrementales para MySQL/SQL Server; integración instala el baseline con `DB_SYNC=false` | Falta observar CI con motores reales, validar el camino de actualización desde bases históricas y aplicar migraciones aprobadas en el servidor elegido |
| ETL certweb | Carga parcial de planteles y alumnos; modo de simulación disponible | Confirmar esquema de origen, completar usuarios/docentes/grupos y probar contra ambos destinos reales |
| Producción | Variables de configuración y compilación disponibles | Hosting, dominio, TLS, respaldos, monitoreo, almacenamiento duradero y cuentas externas aún dependen de decisiones/credenciales |
| Pruebas | Suite unitaria backend y suite HTTP configurada para MySQL/SQL Server en CI; cobertura unitaria de grupos inactivos para maestro | Falta ejecutar la suite HTTP contra ambos motores y ampliar casos de actividad/entrega y más límites de permisos |
| Privacidad y publicación | No se completa desde el código | Textos legales, aviso institucional, cuentas de tiendas y aprobación del cliente |

## Dependencias del cliente o del entorno

- Esquema sanitizado o acceso de solo lectura a certweb para fijar el mapeo ETL real.
- Motor/hosting definitivo y acceso controlado a la base destino.
- Credenciales SMTP y Openpay sandbox/producción.
- Dominios, certificados, proveedor de despliegue y política de respaldos.
- Identidad institucional, aviso de privacidad y textos legales aprobados.
- Cuentas Apple Developer y Google Play Console si se distribuirá la app.

## Verificación conocida

Verificado en el árbol de trabajo el 2026-09-30: backend lint, typecheck y build pasan; Jest pasa con 21 suites y 89 pruebas; web lint/build, `mobile npx tsc --noEmit` y 3 pruebas ETL también pasan. Swagger genera metadata de esquemas DTO en el build.

La suite HTTP instala un baseline versionado y cubre autenticación, alcance por plantel, operaciones académicas, generación concurrente de colegiaturas, pagos, descarga firmada y webhooks de Openpay. La suite completa no se ejecutó localmente: requiere `RUN_DB_INTEGRATION=1` y una base aislada, y aquí no hay Docker ni servicios en 3306/1433. La última ejecución remota conocida (commit `38b7f36`) falló por no configurar `/api` en el bootstrap de pruebas; el árbol local ya contiene ese arreglo y el workflow usa `DB_SYNC=false`, pero ambos jobs necesitan una nueva ejecución para confirmar MySQL y SQL Server.

Limitaciones restantes: la restricción histórica de unicidad de grupos por ciclo/nombre no se puede reemplazar sin retirar un índice existente, acción prohibida por las reglas actuales; el repositorio no tiene aún runner ni registro automático de migraciones. No se debe certificar Fase A hasta que ambos jobs de integración queden verdes. La aceptación visual/accesible final y pruebas con credenciales Openpay sandbox también requieren el entorno y los responsables correspondientes.
