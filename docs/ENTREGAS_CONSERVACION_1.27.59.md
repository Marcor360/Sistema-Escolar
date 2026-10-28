# Entregas y conservación académica · 1.27.59

Base: rama de deuda técnica 1.27.58 (#207), sobre main 1.27.57 (#206). PR apilado: integrar #207 antes de este PR. No hay despliegue ni ejecución sobre datos institucionales.

## Entregas de alumnos

- `POST /api/actividades/:id/entrega` conserva permisos y validación de inscripción/recursamiento. Acepta multipart con un solo archivo de hasta **104857600 bytes (100 MiB)**. Este límite es independiente de `MAX_UPLOAD_MB`, que sigue aplicando a materiales; biblioteca, logos y calendario conservan sus límites propios.
- Formatos: PDF; DOC/DOCX, XLS/XLSX, PPT/PPTX; ODT/ODS/ODP; RTF, CSV, TXT, MD; PNG/JPG/JPEG/WebP/GIF/BMP; ZIP; MP3/WAV/MP4/M4A. Se comprueban extensión y firma/formato de la muestra inicial. No se ejecutan ni descomprimen adjuntos. La inspección de firma no equivale a un antivirus ni valida íntegramente un documento o contenedor Office. No se habilitan ejecutables, HTML ni formatos de macros por extensión.
- `respuestaTexto` es opcional, plano y de hasta **3000 caracteres**. Se acepta en JSON o multipart. Una entrega nueva exige archivo o respuesta no vacía; comentario opcional de 500 caracteres no sustituye la tarea. El servidor valida el límite aunque se eluda el cliente.
- Expo permite elegir **Adjuntar archivo** o **Escribir respuesta**, con contador y editor multilínea. No necesita abrir el selector al entregar texto; conserva preflight, vigencia, bloqueo de doble toque y confirmación de reentrega. Subidas esperan hasta cinco minutos.
- Enviar texto conserva el archivo de una entrega anterior. Elegir y confirmar un nuevo archivo mantiene el reemplazo explícito existente, que retira el archivo sustituido después de confirmar la transacción. Esto es distinto de una purga automática por cambio de estado escolar, que no se habilita. Enviar un archivo desde el nuevo cliente limpia la respuesta escrita anterior para no atribuirla al archivo nuevo. Una entrega calificada sigue siendo inmutable para el alumno.
- Docentes consultan la respuesta escrita en listado, captura y tabla de entregas, como texto React literal, sin interpretar HTML. Los archivos mantienen descarga privada y firma de sesión.

## Conservación sin borrado

`GET /api/alumnos/:id/conservacion-adjuntos`: ADMINISTRATIVO por plantel y SUPERADMIN global; excluye FINANZAS/MAESTRO/ALUMNO. Agrupa referencias de adjuntos de entregas por ciclo, sin exponer rutas físicas. Es un inventario, no un lote de eliminación. Devuelve siempre `eliminacionHabilitada=false`, declara conservación/recuperación pendientes y señala ciclos no cerrados o egresos legados sin conciliar. No encola archivos, modifica registros, comprime ni elimina nada.

La cola genérica de limpieza comprueba que un archivo no siga referenciado por una entrega o material antes de borrarlo; si lo está, conserva la fila y difiere la limpieza con `REFERENCIA_ACADEMICA_VIGENTE`. Los flujos de baja, promoción y recursamiento no ganan ninguna purga automática. **PAUSA no se añade como estado**: no hay reglas aprobadas para sustituirla por BAJA ni para borrar adjuntos en ese supuesto.

No se eliminan calificaciones, revisiones, inscripciones ni pagos por estas operaciones. La instantánea `.json.gz` de egreso sigue siendo secundaria, sin SQL completo ni archivos físicos: no sustituye respaldo ni ensayo de restauración. El archivado automático conserva su habilitación independiente y permanece deshabilitado por defecto.

## Conciliación de egresos anteriores

`POST /api/alumnos/:id/egreso/conciliacion`: exige `cicloId`, `curp`, `fechaEgreso` documental **YYYY-MM-DD**, `referenciaDocumental` y `confirmado=true`. La pantalla en el historial inicia todos los datos documentales vacíos, muestra ciclos de la página consultada y pide confirmación antes de registrar.

La transacción bloquea el alumno y ciclo, exige EGRESADO, CURP exacta frente al expediente, ciclo CERRADO perteneciente a una inscripción del alumno y fecha no futura ni anterior al inicio del ciclo. No deduce fecha/ciclo de la última inscripción ni corrige CURP de forma implícita. Unicidad por alumno/CURP y auditoría institucional; en una carrera concurrente solo una solicitud confirma. Los datos faltantes o contradictorios permanecen sin conciliar.

La nueva columna nullable `egresos_alumnos.fecha_documental` preserva el día de la evidencia, sin inventar una hora real de egreso. `fecha_egreso` mantiene su contrato técnico datetime, normalizado a las 12:00 UTC para estos legados; no representa una hora probada. La interfaz prioriza la fecha civil almacenada y la retención de cinco años se calcula desde ese día. Los egresos nuevos conservan su instante original; no se hace backfill de registros anteriores.

## Migración y operación

Migraciones incrementales espejo `database/mysql/migracion_entregas_texto_fecha_documental.sql` y `database/sqlserver/migracion_entregas_texto_fecha_documental.sql`: añaden `entregas.respuesta_texto` nullable (VARCHAR/NVARCHAR 3000) y `egresos_alumnos.fecha_documental` DATE nullable. El manifiesto y schemas documentales reflejan la ampliación. No ejecutar schema.sql ni DB_SYNC. Respaldar/ensayar restore y desplegar API/migración/clientes coordinados; la app anterior sigue pudiendo enviar archivos, pero requiere actualización para texto/100 MiB.

IIS debe aceptar multipart por encima de 100 MiB. `Set-IISTareasLimit-Staging.ps1` inspecciona sin cambiar el sitio por defecto; `-Apply` eleva el límite a 110 MiB sin reducir uno mayor. Nuevos sitios usan ese margen. Revisar también timeout de ARR/proxy (mínimo recomendado cinco minutos), espacio y ACL. No se ha aplicado al host institucional ni se ha probado Android/iOS físico.

## Evidencia

Se registrará el resultado de checks locales e integración aislada al cerrar el PR. Las pruebas de integración incorporan subida real de 100 MiB, rechazo de 100 MiB+1 y limpieza de temporales, texto de 3000/3001, entrega vacía/calificada, aislamiento por rol/plantel, conservación de archivo y conciliación concurrente sin alterar notas, revisiones, inscripciones ni pagos. Son fixtures sintéticos en bases nuevas MySQL/SQL Server; no UAT ni respaldo institucional.
