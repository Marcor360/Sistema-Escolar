# Listados de diez — PR 109

Los listados cubiertos y el DTO común usan diez registros por defecto. Los
consumidores que solicitan otra cantidad conservan el máximo de cien. Las
exportaciones no se limitan artificialmente a diez registros.

Las resoluciones de conciliación ahora se filtran y paginan en el servidor por
plantel; la UI permite recorrer su historial sin descargar ni recortar el lote
histórico. La ruta anterior de bitácora conserva su contrato.

La regresión del selector usa 115 alumnos: diez opciones, doce páginas,
navegación remota y búsqueda de un alumno que no está en la primera página,
restableciendo página uno. Hay pruebas de DTO, alcance y offset de resoluciones,
y casos HTTP de permisos/límites que ejecuta CI con MySQL y SQL Server. Los
fixtures responsive se actualizaron al contrato de diez y al nuevo endpoint.

Este PR implementa la parte de paginación de #105; no implementa la arquitectura
global de paneles, rutas de edición enfocadas ni nuevos módulos de #97–#104.
Las dependencias siguen en sus incidencias y no se consideran cerradas al fusionar.
