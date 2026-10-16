# Baja y eliminación definitiva

La baja de alumnos o docentes y la desactivación de personal conservan el expediente y su historial. Son acciones diferentes de **Eliminar definitivamente**.

SUPERADMIN dispone de eliminación definitiva en Alumnos, Docentes, Planteles y en la pestaña Personal de Usuarios. La confirmación identifica el registro y advierte que la operación no se puede deshacer. Alumnos y docentes se eliminan desde su expediente: también se elimina su cuenta, sus roles, asignaciones, notificaciones, tokens y sesiones. La cuenta deja de poder autenticarse.

La eliminación se bloquea si el registro tiene información vinculada, incluso histórica o con borrado lógico: inscripciones, clases, calificaciones, entregas, pagos, cargos, incidencias, biblioteca, eventos o autoría de operaciones. En esos casos, usa la baja/desactivación. No se eliminan expedientes completos en cascada ni se pierde información de terceros. Para un plantel sin historial, retira o reasigna primero su personal activo. Las asignaciones inactivas se limpian al eliminarlo.

No puedes eliminar tu propia cuenta. Los roles locales no pueden usar esta operación, aunque intenten llamar directamente a la API. La bitácora general de actividad se conserva con los identificadores originales.

## API

`DELETE /api/{alumnos|docentes|planteles|usuarios}/:id/permanente`

Requiere sesión WEB de SUPERADMIN y cuerpo JSON `{"confirmacion":"ELIMINAR"}`. Devuelve 200 al eliminar, 400 si falta confirmación, 403 sin permiso, 404 si no existe y 409 si hay vínculos o se intenta borrar la propia cuenta. Los endpoints anteriores de baja y desactivación mantienen su comportamiento.

La operación usa una transacción SERIALIZABLE; una restricción de clave foránea revierte toda la operación. No modifica el esquema ni requiere migraciones.
