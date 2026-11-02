# Preparación de un piloto de producción

Revisión 2/nov/2026. Un piloto productivo usa usuarios y datos reales, por lo que
requiere recuperación y soporte comprobados. Que CI apruebe no lo activa ni
sustituye la aceptación de la institución. Este documento organiza el trabajo;
no declara cumplidas las puertas de `BETA_ACEPTACION.json`.

## Alcance y condiciones de entrada

Seleccionar un plantel, responsables y un grupo limitado de usuarios. Registrar
qué módulos se usarán y qué funciones permanecen deshabilitadas. Comenzar con
altas/cartera, asignación de correo y activación, inscripción, captura docente,
consulta de alumno y pagos manuales según permisos. Openpay, push, consentimiento
y ETL requieren sus validaciones específicas antes de incorporarse al alcance.
No depender de migración general desde el legado: el ETL actual es parcial.

| Paso | Responsable a designar | Evidencia para continuar |
| --- | --- | --- |
| Fijar versión y proteger main | Mantenimiento | SHA integrado, CI aprobado, revisión y controles efectivos de rama |
| Ensayar actualización en staging | Operación | JSON público configurado, versión local/pública correcta y portal funcional |
| Ensayar recuperación | Operación | Restauración de BD y uploads en entorno separado, hashes/integridad y tiempos observados |
| Verificar infraestructura | Operación | TLS, ACL, secretos, almacenamiento, antivirus y respaldos fuera del servidor |
| Aceptar procesos | Control Escolar, Finanzas y representantes | Casos UAT por rol/plantel con esperado, obtenido y evidencia |
| Preparar soporte y alertas | Operación y responsable institucional | Contactos, horarios, alertas de caída/errores/respaldos y procedimiento de incidentes |
| Autorizar inicio | Responsable institucional | Alcance, fecha, participantes y pendientes aceptados por escrito |

Las confirmaciones previas de Android, correo, logo y permisos no se pierden.
Solo se repiten las comprobaciones afectadas por cambios o por el entorno nuevo.
Si el piloto no incluye iOS, documentar esa exclusión sin marcar iOS aprobado.

## Recorrido previo con datos ficticios

1. Crear un alumno y comprobar duplicados de CURP, matrícula y correo sin cuentas
   huérfanas. Probar también apertura integral sin correo, pausa y asignación posterior.
2. Activar la cuenta, iniciar sesión y comprobar que solo consulta lo propio.
3. Corregir datos autorizados; rechazar cambio de estatus/plantel mediante PATCH.
4. Inscribir por cartera y comprobar cuotas/idempotencia; asignar grupo y materia.
5. Capturar notas con el docente asignado; publicar/consultar según el contrato vigente.
6. Registrar pago parcial y verificar saldo e historial sin duplicados.
7. Transferir con permisos de origen/destino: conservar cobros de origen y terminar
   inscripciones anteriores; no inscribir silenciosamente en destino.
8. Dar de baja: rechazar sesiones anteriores y códigos pendientes. Reactivar con
   motivo real: no restaurar inscripciones ni revivir códigos o sesiones antiguas.
9. Egresar solo con antecedente de ciclo cerrado; conservar expediente y evidencia.
10. Eliminar definitivamente solo un expediente ficticio sin historial, mediante
    SUPERADMIN y confirmación; rechazar cualquier expediente con vínculos.

Pruebas técnicas y sus límites: [barrido de alumnos](BARRIDO_Y_CICLO_ALUMNOS_2026-11-02.md).
La ejecución institucional se registra en la [matriz UAT](UAT_MATRIZ_2026-10-15.json)
con autorización y evidencia; no trasladar automáticamente resultados de Jest.

## Continuar o detener

Antes del inicio, acordar RPO (pérdida máxima de datos aceptable), RTO (tiempo de
recuperación) y horarios de soporte. Usar mediciones del ensayo, no promesas.
Durante el piloto revisar errores, accesos denegados, correos pendientes,
respaldos, capacidad y conciliación de saldos con los responsables.

Suspender nuevas operaciones si aparece acceso entre planteles no autorizado,
pérdida de integridad, cargos duplicados o imposibilidad de recuperar el servicio.
Preservar evidencia y conciliar operaciones antes de reanudar. El rollback de
aplicación no revierte migraciones ni operaciones de usuarios.

La ampliación a otros planteles depende de aceptación documentada, soporte
estable y recuperación comprobada. No ampliar por cumplir solo una fecha.

## Fuentes operativas

- [Actualizador coordinado](ACTUALIZACION_INTEGRAL_1.35.14.md).
- [Operación y recuperación](OPERACION_PRODUCCION.md).
- [Migraciones](MIGRACIONES.md) y [matriz de acceso](MATRIZ_ACCESO.md).
- [Puertas de aceptación](BETA_ACEPTACION.json).
