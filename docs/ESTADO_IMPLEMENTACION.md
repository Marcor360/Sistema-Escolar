# Estado de implementación — 1.15.0

Código implementado no equivale a certificación del piloto. El servidor existe según el usuario, pero todavía no se dispone de configuración y acceso de staging verificados ni evidencia de pruebas físicas.

| Área | Código disponible | Pendiente de aceptación/entorno |
|---|---|---|
| Identidad | Altas desde expediente, baja/egreso/transferencia, revocación, inscripción coherente y reasignación docente | Aceptar política de egresados y no reactivación automática |
| Sesiones | Access 15 minutos, refresh rotativo por dispositivo, hash persistido, cookie HttpOnly web, SecureStore móvil, cambio inicial obligatorio | Despliegue coordinado y prueba real HTTPS/expiración en navegador y dispositivo |
| Academia | Contexto vigente, inscripción única por ciclo, grupo con ciclo inmutable, validación de plantel/materia/docente activos | Revisión con datos y personal institucional |
| Calendario | Global/plantel/grupo, fechas validadas, intervalo acotado sin límite silencioso de filas | QA de uso real |
| Calificaciones | Captura transaccional, motivo al corregir, cierre con resumen y sin faltantes, historial y reapertura autorizada | Aceptar regla oficial P1-P3 y formato institucional |
| Reportes | Boleta por ciclo/inscripción; maestro solo concentrado propio; Excel incluye inscritos sin nota; promedio backend compartido | Certificar boleta con control escolar |
| Web | Edición, transferencia, baja, egreso, historial, boleta, planteles/clases docentes, correcciones de grupos, búsqueda paginada | Recorrido administrativo completo con personal; Chrome/Edge y revisión AA/lector de pantalla |
| Finanzas | Cancelación y anulación sin DELETE, auditoría y recálculo, conciliación, previews con plantel explícito, adeudos paginados | Certificar Openpay sandbox, políticas contables y pruebas de incidencias con proveedor |
| Móvil | Solo alumno, refresh SecureStore, error/reintento, último estado en memoria con fecha, estados de pagos, preview APK configurado | Build EAS firmado, Android físico, regreso de Openpay, red/archivos; iOS físico si se distribuirá |
| Archivos | Enlaces firmados, firmas por formato, reemplazo con limpieza posterior al commit | Disco persistente, backup/restore y controles operativos; firma básica no es antivirus |
| Base | Baseline v1 intacto, migraciones espejo, DB_SYNC=false y paridad física probada en ambos motores | Ensayo de copia histórica y actualización real del servidor |
| SMTP | Recuperación con token de un uso, expiración y logs sin destinatario/asunto | Proveedor, buzón real, remitente y errores reales |
| Operación | Scripts Windows, IIS/ARR, proxy local confiable, logs con request ID, health live/ready y carga de consultas | DNS/TLS/firewall, servicio, ACL, monitoreo, restore cifrado externo y RPO/RTO observado |
| ETL | Parcial, planteles/alumnos; tres pruebas automatizadas | Esquema certweb sanitizado para completar mapeos sin inventarlos; decidir si historial entra al piloto |
| Privacidad/publicación | Documentación técnica disponible | Aviso aprobado, responsable de operación, cuentas de distribución y aprobación de salida |

## Evidencia y archivos

[CORRECCIONES_1.15.0.md](CORRECCIONES_1.15.0.md) registra verificaciones y archivos de esta implementación. [REGLAS_PILOTO.md](REGLAS_PILOTO.md) fija las políticas. [PUBLICAR_SERVIDOR_EXISTENTE.md](PUBLICAR_SERVIDOR_EXISTENTE.md) guía la configuración del servidor existente.

La CI previa de `41f5579b7313f3353a1f64a984d5c44ea2b9521c` pasó [los siete jobs](https://github.com/Marcor360/Sistema-Escolar/actions/runs/37654400092). Es evidencia de ese baseline; cada nuevo SHA debe tener su propia ejecución. No emitir ACTA DE PREPARACIÓN PARA PILOTO aprobada hasta obtener todas las pruebas externas de la Fase 5.

La auditoría original se conserva como referencia histórica en [AUDITORIA_2026-10-07.md](AUDITORIA_2026-10-07.md); sus hallazgos se evalúan con las correcciones y evidencias posteriores, sin modificar retrospectivamente sus conclusiones.
