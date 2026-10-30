# Identidad estructurada: segundo nombre y apellidos · 1.35.5

## Compatibilidad de datos
- `usuarios.nombre` conserva su valor histórico, incluso si contiene varios nombres. No se infiere ni separa retroactivamente.
- `usuarios.segundo_nombre` es opcional y nuevo: solo se llena cuando personal autorizado captura explícitamente un segundo nombre.
- `apellidoPaterno` y `apellidoMaterno` se validan como requeridos en nuevas altas de personal, docentes y alumnos. En actualizaciones parciales se conserva el dato anterior si no se envía; en cambios explícitos no debe aceptarse un apellido vacío.
- Se generan nombres completos en el orden nombre + segundo nombre + dos apellidos. Los datos de menores siguen restringidos por ScopeService.
- Las apps anteriores aún pueden leer cuentas y perfiles; **las altas realizadas por clientes antiguos sin segundo apellido ya no superarán la validación**. Actualizar primero formularios y coordinar el despliegue.

## Migraciones
Archivos: `database/mysql/migracion_segundo_nombre_usuario.sql` y `database/sqlserver/migracion_segundo_nombre_usuario.sql`.
`ALTER TABLE usuarios` agrega columna nullable, sin borrar ni transformar información histórica. Aplicar solo mediante el migrador habitual y con respaldo verificado antes de desplegar la API que consulta la nueva columna.

## Evidencia
Pruebas de validación de altas y conservación de nombres compuestos. Confirmar CI backend, tests de API y paridad de migraciones. UAT: altas sin segundo nombre, segundo nombre registrado, ausencia de uno o ambos apellidos, corrección sin perder nombre, búsqueda, impresión y permisos. No se realizaron migraciones en staging.
