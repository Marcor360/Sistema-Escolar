# Acta y boleta informativas · 1.27.9

Referencias proporcionadas por el cliente: `ACTA_CALIFICACIONES-11.pdf` (2 páginas) y `Machote boleta Superior.pdf` (4 páginas), recibidas el 20 de octubre de 2026. Los PDF están divididos por el área de impresión original; las exportaciones nuevas ajustan todas las columnas al ancho. Los originales contienen datos personales y no se incorporan al repositorio.

## Flujos implementados

- **Calificaciones → seleccionar clase y parcial → Acta de evaluación:** tabla digital por alumno, Excel para rellenar y Excel con notas guardadas. Profesor: exclusivamente su clase activa; Control Escolar: únicamente planteles autorizados; SUPERADMIN: global.
- **Alumnos → Historial y boleta → Ver boleta informativa y Excel:** borrador digital y descargas Excel/PDF para Control Escolar. Se identifica como borrador si falta captura o cierre.
- **Expo → Calificaciones → Ver boleta:** tabla de la inscripción elegida y descargas Excel/PDF propias. Mientras no estén completos y cerrados P1–P3 de todas las materias de esa inscripción, se muestra un mensaje pendiente, sin filas ni descarga. Final no sustituye P1–P3.
- Las descargas móviles viajan en un enlace firmado de dos minutos vinculado a sesión, identidad, inscripción y formato. La autorización y el estado de publicación se comprueban de nuevo al descargar. La boleta PDF anterior también bloquea la emisión al alumno antes del cierre; Control Escolar conserva la revisión de borradores.

## Correspondencia con los formatos

**Acta:** institución, coordinación, plan, periodo/cuatrimestre, ciclo, asignatura, profesor, plantel, grupo, número de lista, matrícula, apellidos y nombre, casillas de asistencia (. / F), faltas, evaluación continua, examen, calificación parcial, observaciones y espacios de firma de profesor/coordinación/Control Escolar. El listado se ordena por apellidos y nombre. El Excel vacío conserva identificación y contexto; borra únicamente las evaluaciones y observaciones de captura.

**Boleta:** institución, plantel, plan, alumno, matrícula, periodo, grupo, clave, asignatura, créditos con dos decimales, seriación, ciclo escolar, promedio final vigente, observaciones y promedio general, con espacio de sello/firma de coordinación. El logo usa la configuración institucional si existe un PNG/JPEG local. No contiene firmas electrónicas ni folios oficiales inventados. La fuente Onest se incorpora al PDF con su licencia OFL para evitar dependencia de fuentes del servidor.

## Pendientes explícitos

- El ejemplo contiene notas 8–10. Se mantiene la escala vigente **0–100**, sin dividir datos históricos ni inferir equivalencias. Hace falta confirmar la escala oficial.
- No se infieren ponderaciones de evaluación continua y examen, redondeos, asistencia mínima o extraordinarios. No se cambia el promedio vigente P1–P3 ni se mezcla Final. El promedio general se muestra únicamente con todas las materias completas y cerradas.
- Asistencia diaria, faltas, evaluación continua y examen desglosado **no tienen almacenamiento en el modelo actual**: quedan vacíos en Excel y como «sin registro» en la vista. Los profesores pueden rellenarlos en el archivo, pero no se importan ni calculan automáticamente. Seriación también queda vacía por falta de registro de prerrequisitos.
- **El acta de impresión no es un archivo importable.** Para subir notas se conserva la plantilla normalizada de importación, su preview y confirmación transaccional. Guardar un Excel no cambia el sistema.
- El cierre sigue siendo de Control Escolar. Esta entrega no otorga al docente permisos nuevos para cerrar o reabrir ni declara aprobadas las reglas pendientes de #139/#147.
- Sin cambios de esquema, migraciones o dependencias npm. No se ejecuta despliegue ni activación institucional.

## API

- `GET /reportes/formatos/acta/:id?parcial=1`
- `GET /reportes/formatos/acta/:id/excel?parcial=1&plantilla=true|false`
- `GET /reportes/formatos/boleta/:alumnoId?inscripcionId=...`
- `GET /reportes/formatos/boleta/:alumnoId/excel?inscripcionId=...`
- `GET /reportes/formatos/boleta/:alumnoId/pdf?inscripcionId=...`
- `GET /reportes/formatos/mi-boleta?inscripcionId=...`
- `GET /reportes/mi-boleta/enlace?inscripcionId=...&formato=informativa-pdf|informativa-excel`

Todos los endpoints JSON/descargas nuevos requieren autorización; la descarga firmada conserva la ruta existente y valida el token. No se abre una carpeta pública de archivos escolares.

## Validación

Pruebas de servicio: identidad ajena, alcance del plantel histórico, bloqueo por cierre/nota faltante, Excel/PDF, nota cero y plantilla vacía. Pruebas web: acta, identificación de datos ausentes y modos de descarga distintos. Prueba móvil: selección de inscripción y enlace privado Excel. Integración ampliada en ambos motores: boleta cerrada propia y formatos PDF/Excel firmados; los casos de boleta pendiente esperan 409. CI y aceptación física/institucional deben verificarse antes de integrar.
