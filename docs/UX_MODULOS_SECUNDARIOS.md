# Formularios secundarios — seguimiento de #105

Conducta separa alta, consulta paginada y seguimiento por identificador. Los formularios no descargan el historial. El regreso conserva ciclo/página; las respuestas obsoletas se descartan y los fallos conservan el borrador. La información sigue siendo interna a personal autorizado, sin notificaciones al alumno.

Biblioteca separa crear carpeta, subir archivo y consultar archivos privados. El selector de carpetas usa `GET /biblioteca/carpetas?plantelId=...`, autorizado por ScopeService, con el límite existente de 500 carpetas por sede. No descarga archivos para montar un formulario. La consulta conserva plantel/carpeta/página y mantiene diez archivos por página. Las descargas continúan mediante enlaces privados, antivirus, cuotas y validación existentes.

Calendario separa alta/edición de consulta. `GET /calendario/listado` añade paginación (diez por defecto, máximo cien), búsqueda literal por título, orden fecha/id estable y los mismos filtros de visibilidad del endpoint de arreglo. `GET /calendario/:id` es un detalle de edición autorizado con las reglas de origen. La revisión optimista permanece obligatoria en PATCH. El endpoint de arreglo se conserva para clientes existentes.

Importar expedientes, promover alumnos y consultar bitácora son operaciones separadas, filtradas por los roles existentes. Las previsualizaciones no se consideran guardadas; salir exige confirmar la pérdida del borrador. Solo la confirmación efectiva del lote marca el formulario como guardado.

El guardián común permite modificar filtros/contexto en la URL dentro del mismo formulario sin tratarlo como abandono; conserva la confirmación al salir y bloquea la navegación mientras hay solicitudes pendientes.

Esta entrega no modifica reglas de evaluaciones, calificaciones, roles financieros ni la operación propia del alumno. Continúan el trabajo específico de captura académica y la revisión de Expo, además de UAT. No acredita staging ni despliegue. No requiere migraciones de esquema.
