# Avance de remediación — 2 de octubre de 2026

## Fase 0 — estabilización de CI

La ejecución GitHub Actions `1.8.2` (run `37038935551`) mostró fallos de workers Vitest y límite de login. El commit `1.8.3` corrigió ambos; su run `37096455364` pasó 14 de 15 pruebas de integración por motor, y señaló una expectativa incorrecta sobre dos alumnos inscritos, además del aviso nuevo de `braces` en npm audit.

El [run `37097877896` del PR #1](https://github.com/Marcor360/Sistema-Escolar/actions/runs/37097877896), commit `88b9467`, terminó verde en los seis jobs: Backend, Web, Mobile, ETL, MySQL y SQL Server. Se verificó `DB_SYNC=false` en ambos jobs de base. Queda integrar el PR y comprobar el run de `main`.

Correcciones aplicadas:

- Web ejecuta Vitest con un worker para evitar fallos de creación de procesos en el runner Linux.
- Las pruebas de integración generan JWT de fixture para los flujos protegidos y conservan una llamada real a `/auth/login`; no se cambia el límite de autenticación de cinco intentos.
- Ambos jobs de base ya mantienen `DB_SYNC=false` y el baseline instalable en una base aislada. MySQL cuenta con health check de servicio; SQL Server cuenta con health check y reintentos con timeout para crear la base cuando el servidor queda listo.
- La suite de colegiaturas concurrentes comprueba dos cargos únicos para los dos alumnos inscritos.
- Backend y Web actualizaron Jest/TypeScript ESLint; `npm audit` completo reportó cero en CI. Web usa jsdom compatible con Node 20.

Verificación local de este corte: backend lint, typecheck, build y 106 pruebas; web lint, 5 pruebas y build; mobile 2 pruebas, TypeScript y export Android; ETL 3 pruebas. El test de integración compila sin errores. La ejecución real de MySQL y SQL Server quedó certificada por Actions en el PR; esta máquina no tiene Docker.

La base de avisos npm incorporó `GHSA-vfj7-8cjw-p6xm` para `braces` hasta 3.0.3 y actualmente no declara una versión corregida. Backend y Web eliminaron esa ruta transitiva al actualizar sus herramientas y mantienen `npm audit` completo. Mobile conserva dos excepciones exactas de Expo/Metro documentadas en `EXCEPCIONES_NPM_AUDIT.md`; otros avisos altos/críticos siguen fallando en CI.

Este corte complementa `AUDITORIA.md`, cuya revisión inicial fue el 1 de octubre. Los cambios están en el árbol de trabajo y aún no se han desplegado ni validado con las cuentas o servicios institucionales.

## Riesgos corregidos en código

- Los pagos manuales bloquean el cargo, calculan el saldo dentro de la transacción y rechazan excedentes. Un pago capturado por Openpay que ya no se puede aplicar queda registrado como pago no aplicado y en bitácora para revisión de Finanzas.
- Una orden Openpay creada o pendiente reserva el cargo frente a pagos manuales. El procesamiento concurrente del webhook vuelve a bloquear cargo y orden, valida importe y es idempotente.
- Producción exige API Openpay productiva, retorno HTTPS, credenciales de comercio y usuario/contraseña del webhook. Producción exige configuración SMTP; fallos de entrega de recuperación quedan registrados sin cambiar la respuesta pública genérica.
- El seed ya no tiene contraseñas de cuentas demo en código. Exige cinco secretos diferentes de al menos 16 caracteres y fija `synchronize: false`.
- Se añadieron pruebas unitarias de excedentes, pagos parciales exactos, pagos Openpay no aplicados, configuración de producción, contraseñas seed y error SMTP. La integración conserva escenarios de pagos parciales, reserva de órdenes, webhooks concurrentes y descarga firmada.
- Los estados móviles distinguen carga inicial, error y lista vacía; los textos de aviso usan un tono oscuro y los controles móviles principales tienen áreas táctiles de 44 dp. El login web ya usa ancho fluido para viewports estrechos.
- CI revisa dependencias, espera disponibilidad de SQL Server, ejecuta pruebas web/móvil y exporta el bundle Android de Expo.

## Dependencias

La auditoría npm del PR informa cero vulnerabilidades en backend y web. El móvil conserva dos alertas altas transitivas: GHSA-86w9-cpqp-85rv (`node-forge`) y GHSA-vfj7-8cjw-p6xm (`braces`), dentro de Expo/Metro. Las excepciones específicas hacen fallar CI si aparece otro aviso alto/crítico. No se bajó Expo a una versión incompatible.

## Verificación local

- Backend: lint, typecheck, build y Jest — 22 suites; 106 pruebas tras agregar los casos de remediación.
- Web: lint, 2 archivos de prueba / 5 pruebas, build y `npm audit` sin hallazgos.
- Móvil: revisión de auditoría conforme a la excepción, TypeScript y export Android completados.
- ETL: 3 pruebas de adaptadores completadas.

La integración HTTP pasó en MySQL y SQL Server en el run `37097877896` del PR #1. La ruta de actualización desde una base histórica sigue pendiente de prueba.

## Pendientes bloqueados por datos o responsables externos

- El ETL de usuarios, docentes y grupos requiere el esquema real de `certweb`; no se inventaron tablas o columnas. Faltan esquema sanitizado/acceso de solo lectura y reglas de identidad para consolidar usuarios.
- El despliegue requiere decidir hosting, dominios, TLS, almacenamiento y respaldos; faltan las credenciales del cliente de SMTP y Openpay, formatos oficiales de reportes y textos legales aprobados.
- La prueba de pasarela exige credenciales sandbox y conciliación aprobadas. La aceptación en dispositivos/navegadores, con lector de pantalla y personal escolar, requiere dispositivos y usuarios acordados.

## Pendientes técnicos del repositorio

- No existe todavía un runner ni un registro automático de migraciones. Antes de implementarlo hay que acordar y probar el mecanismo en MySQL y SQL Server aislados.
- La corrección de unicidad por plantel ya cuenta con entidad y migraciones incrementales MySQL/SQL Server; queda revisar datos y aplicarla por entorno.
- La suite automatizada del portal cubre autorización de rutas y pruebas de mensajes de error, pero necesita más flujos de usuario. El móvil tiene pruebas de utilidades y bundle JavaScript, no compilación nativa firmada ni pruebas de interacción en dispositivo.

No se declara el MVP listo para producción con este corte.

## Actualización del repositorio al 3 de octubre de 2026

Este documento conserva los resultados observados el 2 de octubre. Desde ese corte, `main` incluye el runner protegido de migraciones (`db:migrate`, `db:migrate:status` y `db:migrate:adopt`), el manifiesto de baseline y el flujo `adopt/up/status` ejercitado por la suite de integración aislada en MySQL y SQL Server en CI. Por eso, la nota anterior de que no existía runner ya no describe el estado actual. El runner sigue sin rollback, no debe ejecutarse en paralelo y no se ha validado contra una base institucional histórica.

La suite de integración ahora comprueba activación secuencial de ciclos en ambos motores. Se agregó un caso de activación concurrente; queda pendiente de la siguiente ejecución CI. La máquina local no tiene Docker instalado, así que esta revisión no ejecutó integraciones DB.
