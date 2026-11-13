# Recorridos por tarea · portal y alumno

Cambios locales, pendientes de publicación. Las guías explican la secuencia y las comprobaciones; nunca guardan formularios, envían tareas, generan cargos ni confirman operaciones por el usuario.

## Portal administrativo

- Guías de carga académica, finanzas, control escolar, docencia, supervisión y cuenta revisadas. Se añadieron Dirección; boletas, recursamientos y programas; biblioteca, calendario y avisos.
- Cada guía permite elegir un paso, reducir el panel conservando la posición, continuar y abrir explícitamente la pantalla correspondiente.
- Los indicadores abren la vista de consulta. Conciliación, trámites, calidad, pendientes, respaldos y preferencias tienen enlaces específicos dentro de Seguimiento.
- Seguimiento incorpora navegación entre herramientas. Una sección desconocida o ajena al rol vuelve a la vista general autorizada; los componentes restringidos conservan su comprobación de rol.
- Se renumeran los pasos después de filtrar permisos. Las preferencias de recorrido existentes conservan sus claves; la actualización no obliga a repetir guías.

## Alumno: app y portal Expo web

- Índice de pasos seleccionables desde la guía, accesible desde Perfil.
- Destinos directos a Calendario, Mis materias, Mis tareas y Ventanilla. Preferencias abre su sección en seguimiento, en lugar de remitir al inicio.
- Abrir una pantalla pausa la guía y permite consultar o trabajar. Continuar retoma el paso; finalizar conserva la preferencia de no apertura automática.
- El acceso previo registrado por la API sigue evitando el recorrido automático entre app y portal.

## Verificación

Se prueban la selección y reducción de pasos, navegación manual sin redirección forzada, enlaces por rol, numeración y apertura directa de tareas sin entrega automática. Los recorridos Playwright de web y alumno usan API simulada en 360, 768, 1280 y 1920 píxeles. Incluyen cierre, continuación, preferencias y carga académica; el alumno también ejecuta la entrega de un archivo de prueba por separado.

No se modifican permisos del servidor, esquema ni datos institucionales. Las pruebas de navegador con datos sintéticos y las exportaciones no acreditan una validación física de Android/iOS ni publicación.
