# UX calendario del alumno Android, iOS y Expo Web · 1.35.4

## Experiencia
- El Inicio ofrece el calendario institucional antes de avisos y eventos, sin mezclar rutas de gestión de personal.
- El alumno puede cambiar entre eventos globales y eventos globales más los de su plantel/nivel/grupo conforme a autorización del API.
- Se utiliza el mes escolar vigente como primera vista cuando cae dentro del ciclo, o el primer mes del ciclo en otro caso.
- La cuadrícula ofrece pulsación de días con conteo y detalle de eventos debajo. En anchos estrechos hay desplazamiento horizontal local para mantener objetivos táctiles.
- La agenda y la imagen siguen disponibles y muestran estados vacíos diferenciados. Se usa `Intl.DateTimeFormat.formatToParts` en `America/Mexico_City` para evitar variaciones entre plataformas.

## Seguridad
`GET /api/calendario` filtra roles, grupos, niveles y audiencias en NestJS; la selección global es una restricción adicional, no una elevación de acceso. Expo Web y las apps móviles usan el mismo componente React Native. No se añaden rutas administrativas ni credenciales en el cliente.

## UAT obligatorio
Android, iOS y navegador a 320/360/768/1440 px; zona horaria distinta a México; cambios de ciclo y filtro durante una consulta; resultados vacíos, errores y reintento, imágenes privadas y alumno sin inscripción. Probar con cuentas ficticias/autorizadas.
No hay nuevas dependencias ni migraciones, ni evidencia de publicación a IIS. Apilado sobre el PR administrativo 1.35.3.
