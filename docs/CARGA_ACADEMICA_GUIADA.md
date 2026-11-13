# Carga académica guiada

Implementada en el portal administrativo, pendiente de publicación. Entrada: **Importar y promover → Preparar carga académica**. También hay enlaces desde Materias, Grupos, Alumnos e Importaciones y un recorrido especializado en el menú de guías.

## Orden de trabajo

1. Revisar plantel, ciclo y oferta académica.
2. Registrar materias del catálogo y vincular sus planes y periodos.
3. Revisar docentes y crear los grupos.
4. En Consultar grupos → Administrar, asignar materias y profesores.
5. Revisar o importar expedientes de alumnos con el rol autorizado.
6. Inscribir mediante Apertura de cartera y comprobar el resultado.

La guía conserva las autorizaciones vigentes: Finanzas y Superadmin pueden dar de alta alumnos; Control Escolar administra grupos y asignaciones. Los enlaces se muestran por rol. La API mantiene la autorización efectiva por plantel y expediente.

Importaciones CSV/XLSX sigue admitiendo alumnos, docentes, personal e inscripciones. Desde 1.37.0 también admite importación masiva de materias y grupos con sus propias plantillas. La inscripción académica importada no genera cargos; la cartera tiene su propia revisión y confirmación.

## Correcciones

- Una nueva previsualización descarta la anterior incluso si falla la consulta. Cambiar de archivo limpia el resultado y los mensajes previos.
- El archivo y el tipo quedan bloqueados desde la apertura de la confirmación hasta la respuesta; una referencia impide envíos concurrentes antes del siguiente render.
- Los enlaces para consultar IDs y para importar calificaciones abren la vista correspondiente.
- Cambiar de vista o de grupo invalida la consulta pendiente y oculta el detalle anterior.
- El selector de materias excluye las ya asignadas; las materias sin docente se corrigen desde la tabla. El formulario no permite asignar sin materia seleccionada.

## Verificación

Lint, compilación web y 291 pruebas unitarias aprobados. La prueba de navegador `web/test/carga-academica.cjs` usa API simulada y comprueba el acceso a la guía, sus seis pasos, el formulario de materias, el grupo y su selector sin duplicados, y el regreso sin detalles residuales, a 360, 768, 1280 y 1920 píxeles. No importa registros reales ni escribe asignaciones.

No se modificaron esquema, permisos del servidor ni datos institucionales. La validación con base real y la publicación se acreditan por separado.
