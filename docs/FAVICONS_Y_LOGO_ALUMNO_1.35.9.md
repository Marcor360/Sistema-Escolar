# Recursos de marca por portal · 1.35.9

SUPERADMIN puede editar un favicon PNG cuadrado (16–512 px, hasta 512 KiB) por portal, y el logo exclusivo del alumno. El logo general continúa siendo el predeterminado. Las imágenes se guardan con nombres inmutables y se sirven exclusivamente bajo prefijos públicos permitidos; los documentos académicos privados siguen protegidos.

Migración espejo aditiva: `migracion_favicons_y_logo_alumno.sql` en MySQL y SQL Server. Backups y restore aislado antes de ejecutar en staging. Comprueba HTTP 200, tipo MIME, CORP, caché, carga con red inestable, navegación entre portales, selección móvil, y controles para SUPERADMIN.

El favicon solo afecta a navegadores. El icono del launcher de la app nativa exige un nuevo build firmado, no puede alterarse mediante la API ya instalada. Esta PR no lo simula.

Sin pruebas locales ejecutadas: se requiere CI de la rama, UAT e inspección manual de ambos entornos.
