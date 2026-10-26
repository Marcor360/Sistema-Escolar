# Calendario por ciclo y nivel · 1.27.52

La entrega amplía el calendario existente con un ciclo escolar y un nivel académico de destino. El personal publica fechas manuales o una imagen del ciclo; los alumnos consultan mes, ciclo completo o imagen en web y en Inicio de Expo. La gestión permanece en web.

## Uso y alcance

En Calendario, seleccionar ciclo y nivel, abrir «Publicar evento o imagen del ciclo» y escribir el título. Para una fecha manual, elegir el día en la cuadrícula o en el formulario; el calendario se arma automáticamente. Para usar una imagen, seleccionar PNG/JPEG/WebP (máximo 10 MiB): se publica para todo el ciclo, sin necesidad de registrar fechas individuales. Las dos modalidades pueden coexistir.

Los niveles provienen de `niveles_academicos`, no de nombres escritos en código: secundaria, bachillerato, licenciatura, maestría, doctorado y certificaciones se separan si están configurados como niveles distintos y los grupos tienen el `nivelId` correcto. Los alumnos sin inscripción vigente o grupos sin nivel no reciben contenido dirigido a niveles específicos. Antes de cargar calendarios, completar ese catálogo y los grupos.

| Actor | Información visible |
|---|---|
| ALUMNO | Audiencia académica de sus niveles inscritos vigentes, dentro de su ámbito; sin fechas internas |
| MAESTRO | Audiencia académica de niveles y grupos vigentes asignados |
| ADMINISTRATIVO / FINANZAS | Todas las audiencias y niveles de sus planteles asignados |
| SUPERADMIN | Todos los niveles, planteles y audiencias |

Las audiencias `ADMINISTRATIVA` y `FINANCIERA` son internas para ambos tipos de personal y SUPERADMIN. Las fechas de corte se registran manualmente; no se generan a partir de cargos ni emiten pagos. Los eventos generales anteriores con `nivelId=NULL` siguen siendo compartidos dentro de su alcance original: revisar y clasificarlos si contienen información exclusiva de un nivel. El formulario anterior de eventos permanece para compatibilidad; el nuevo formulario exige nivel al publicar.

## API y archivos

- `GET /api/calendario/opciones`: ciclos y niveles autorizados.
- `GET /api/calendario` y `/listado`: filtros opcionales `cicloId`/`nivelId`, conservando permisos en servidor.
- `POST /api/calendario`: fecha manual, con ciclo, nivel y audiencia opcionales para compatibilidad. Validación de pertenencia de nivel/plantel/grupo y fechas dentro del ciclo.
- `POST /api/calendario/imagen`: multipart con `imagen`, ciclo y nivel obligatorios; valida extensión, firma y tamaño. Elimina temporales rechazados.
- `GET /api/archivos/calendario/:id/enlace`: autentica y verifica acceso antes de emitir URL firmada de cinco minutos.
- `GET /api/archivos/calendario/:id?t=…`: revalida firma, sesión, rol y ámbito antes de responder imagen con `private, no-store` y `nosniff`. No hay ruta estática pública para las imágenes.

Las consultas de fechas conservan su máximo de 366 días. Los clientes dividen ciclos largos en ventanas y deduplican resultados, sin recortar el ciclo. La cuadrícula usa días de la zona escolar `America/Mexico_City`. Una imagen es un recurso visual: el título sirve como texto alternativo, pero para lectura accesible de cada fecha conviene registrar también eventos digitales.

## Datos y puesta en servicio

Entidad: `EventoCalendario`; columnas nuevas `ciclo_id`, `nivel_id`, `audiencia`, `imagen_nombre`, con FK e índice de ciclo/nivel. Migraciones espejo: `database/mysql/migracion_calendario_ciclo_nivel.sql` y `database/sqlserver/migracion_calendario_ciclo_nivel.sql`, incorporadas al manifiesto. Baseline v1 intacto. `schema.sql` solo documenta paridad.

Antes de desplegar la API nueva, aplicar el incremental mediante el procedimiento operativo de cada ambiente con respaldo y verificación del historial. No ejecutar el esquema completo ni activar sincronización. Este PR no aplica migraciones a servidores ni despliega IIS. Expo requiere una nueva compilación para mostrar esta vista.

La aceptación institucional figura pendiente en la matriz UAT: probar cuentas de cada nivel y plantel, docente, personal mixto, SUPERADMIN, imágenes y cortes internos, teclado/lector de pantalla y Android/iOS físicos. Las pruebas automáticas cubren aislamiento por nivel, ocultación interna, permisos y firma de imagen; no acreditan ese UAT.
