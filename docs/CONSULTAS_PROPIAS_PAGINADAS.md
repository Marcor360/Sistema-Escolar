# Consultas propias paginadas del alumno — #105

`GET /alumnos/me/materias/listado` y `GET /calificaciones/mias/listado` añaden contratos `{datos,total,pagina,porPagina}` con diez por defecto, máximo cien y orden estable. La identidad procede del JWT, no de un alumnoId enviado por el cliente. Se conservan los endpoints de arreglo para clientes anteriores.

Materias aplica las mismas inscripciones vigentes y participaciones en recursamientos que la consulta previa. Calificaciones mantiene el alcance propio del ciclo vigente. La paginación se ejecuta con skip/take y count en la base de datos. El promedio oficial se calcula con todas las evaluaciones de cada materia de la página, aunque sus notas estén repartidas entre páginas; Final sigue siendo independiente y no se inventan evaluaciones pendientes.

Expo usa páginas del servidor en Materias y Calificaciones, con conteo y botones accesibles. Cambiar página limpia el contenido anterior, invalida las respuestas pendientes y cierra los materiales abiertos. Cambiar de identidad vuelve a página uno. La carga de boletas se mantiene separada del cambio de página de notas.

El caché académico sigue siendo solo de memoria, ligado a la sesión y con TTL de cinco minutos. La clave incluye endpoint y página; no se muestra la página uno como copia de una página dos que nunca se consultó. Los archivos privados y las boletas necesitan conexión y sus enlaces existentes; no se persisten notas en disco.

No modifica permisos, escala, reglas de promedio, inscripciones o esquema de base. Las pruebas verifican páginas, identidad, caché, promedio completo y compatibilidad de contratos anteriores. No acredita despliegue ni UAT en dispositivos institucionales.
