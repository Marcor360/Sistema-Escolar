# Reglas implementadas para el candidato 1.15.0

Estas reglas son el comportamiento del código y requieren aceptación institucional antes del piloto.

- **Actividades:** seguimiento de clase. `Actividad.ponderacion` es un peso de seguimiento y no calcula la calificación oficial. La UI lo indica expresamente.
- **Calificación oficial:** captura explícita de P1, P2 y P3; el promedio oficial es su media, redondeada a un decimal, únicamente cuando están completos. `parcial=0` es Final independiente y no se incorpora a esa media. API móvil, Excel y PDF utilizan la misma función backend.
- **Periodos:** no se cierran con alumnos vigentes sin nota. Una corrección de nota u observaciones exige motivo; un periodo cerrado rechaza la captura. Reapertura mediante el flujo autorizado, conservando historial.
- **Vigencia:** ciclo, plantel y grupo activos; inscripción ACTIVA; alumno y cuenta activos. Los grupos conservan su ciclo original. Solo una inscripción activa por alumno y ciclo; bloqueo transaccional del alumno para altas concurrentes.
- **Baja y egreso:** se conserva el expediente y se desactivan cuenta e inscripciones. Un egresado pierde el acceso a la app; control escolar conserva consulta histórica. No hay reactivación automática ni endpoint de reactivación.
- **Transferencia:** termina las inscripciones anteriores y cambia el plantel en una transacción. La inscripción en el grupo destino es una acción posterior explícita. No se permite transferir con PATCH de datos.
- **Docente:** baja desactiva cuenta y planteles; sus clases quedan sin docente para reasignación. Las notas y actividades conservan sus autores. Reasignación verifica docente y cuenta activos y pertenencia al plantel.
- **Eventos:** global sin plantel ni grupo; plantel sin grupo; grupo solo para integrantes autorizados. No basta compartir plantel para ver un evento de otro grupo. Fecha final mayor o igual a inicial; consultas por intervalo de hasta 366 días.
- **Usuarios:** ALUMNO se crea desde Alumnos y MAESTRO desde Docentes. Personal genérico requiere plantel, salvo SUPERADMIN. Contraseña temporal en campos enmascarados y cambio obligatorio antes de operar.
- **Sesión:** acceso de 15 minutos, refresh rotativo con vencimiento máximo de 30 días; hash persistido. Reutilizar un refresh anterior revoca ese dispositivo. Logout revoca la sesión actual; baja/cambio de contraseña o roles invalidan todas las sesiones por versión. Web: bearer en memoria y refresh en cookie HttpOnly/SameSite Strict/Secure en producción. Móvil: SecureStore. Tokens de versiones anteriores requieren nuevo login.
- **Boleta:** alumno propio o control escolar con alcance; maestro usa concentrado de sus clases. Identifica ciclo e inscripción, evitando mezclar grupos tras transferencia. Varias inscripciones en un ciclo requieren seleccionar una.
- **Entregas:** una entrega calificada no puede reemplazarse. Una entrega sin calificar reemplaza su archivo y elimina el anterior después del commit. No se ponen entregas ni pagos en cola offline.
- **Finanzas:** pago manual ligado a cargo; no se ofrece anticipo sin aplicación. Cancelación de cargo exige motivo y ausencia de pagos aplicados/órdenes pendientes. Anulación de pago manual conserva el registro, recalcula saldo y registra actor/motivo. Pagos de pasarela se revisan en conciliación; no se anulan como manuales. Operaciones masivas requieren plantel, preview y confirmación.

## Migración y actualización

Aplicar `migracion_sesiones_rotativas.sql` con el runner existente en ambos motores. Añade `sesiones` y `usuarios.password_change_required`; no cambia el baseline v1. `schema.sql` describe la paridad actual. Mantener `DB_SYNC=false`. Desplegar API y clientes coordinados: la actualización fuerza un nuevo inicio de sesión.

## Comprobación y límites

La suite HTTP contiene 30 pruebas y cubre las transiciones y permisos en bases aisladas MySQL 8.4 y SQL Server 2022. Estas pruebas no certifican Openpay real, SMTP, una base institucional histórica, dispositivos, navegadores ni accesibilidad AA completa. El detalle de verificaciones y archivos está en [CORRECCIONES_1.15.0.md](CORRECCIONES_1.15.0.md).
