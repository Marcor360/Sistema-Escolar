# Docentes por acciones — PR 112

La entrada `/docentes` muestra tarjetas y no descarga el directorio. La consulta
se abre explícitamente y guarda vista, plantel, búsqueda y página en la URL.
La búsqueda usa debounce y parámetros de API; solicita diez resultados por página.

Alta y edición usan `/docentes/nuevo` y `/docentes/:id/editar`, con contenido a
ancho completo y sin menú lateral, campana ni directorio simultáneo. La ruta de
edición vuelve a consultar el expediente, por lo que admite recarga y acceso
directo sin depender de un objeto guardado en memoria. Conserva el control de
sesión y rol ADMINISTRATIVO/SUPERADMIN; la API mantiene la autorización efectiva.

Se usa el router de datos de React Router para bloquear la navegación interna,
incluido Atrás, con el diálogo accesible existente. La recarga/cierre del navegador
usa beforeunload. La detección de cambios incluye los planteles del alta. Durante
el guardado se impide salir y se evita el doble envío; un error conserva el formulario.
Al guardar o cancelar se recupera el contexto de consulta y se enfoca su encabezado.

Pruebas: carga diferida, respuestas de detalle fuera de orden, retorno con
búsqueda/plantel/página, selección de planteles pendiente, cancelar/confirmar salida,
Atrás/recarga, reintento y envío duplicado. El recorrido responsive comprueba
consulta, edición sin menú/directorio, ancho y confirmación de salida en 320, 360,
700, 768 y 1440 px, además de las regresiones generales del portal.

Este PR aplica el patrón a Docentes y ofrece el panel reutilizable; no implementa
la migración de todos los demás módulos de #105 ni altera permisos de backend.
