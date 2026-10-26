# Diseño adaptable de la app del alumno · 1.27.56

Base: main 1.27.55 tras #203 y #204. Entrega exclusiva de presentación Expo; no cambia permisos, API, reglas, caché, sesiones ni almacenamiento privado. Sin migraciones ni dependencias nuevas.

## Cambios y criterio de diseño

- Ancho de lectura máximo de 900 puntos y márgenes de 12/20 puntos según el espacio disponible. Aplicado a Inicio, materias, tareas, notas, estado de cuenta, perfil y documentos. Se recalcula al rotar y descuenta las áreas seguras laterales.
- Inicio: accesos en dos columnas cuando el interior dispone de 640 puntos y la escala tipográfica no supera 1.3; una columna en teléfonos y con letra más grande. Las tarjetas no tienen altura máxima ni recortan textos. La marca se conserva y el texto del distintivo usa contraste sobre el fondo institucional.
- Formularios de Login, activación y recuperación centrados, máximo 480 puntos; menos relleno en teléfonos pequeños. Se conservan desplazamiento con teclado, campos y protección contra envíos duplicados.
- Áreas seguras mediante el proveedor nativo y bordes laterales; el acceso sin sesión reserva también superior/inferior. Los navegadores siguen administrando encabezados y barra inferior. Etiquetas de pestañas siempre debajo del icono.
- Títulos y tarjetas con jerarquía común, descripciones con interlineado y espacio al final de las listas. Se elimina una instrucción genérica repetida en cada encabezado; avisos de red/privacidad propios de cada flujo se conservan.
- Materias/tareas/notas: título y controles dentro del encabezado desplazable de la lista; evita que ocupen toda la altura en horizontal o con letra ampliada. Las listas conservan su virtualización y revalidación.
- Paginación: resumen separado de dos botones flexibles, con altura táctil mínima de 48 puntos y estado deshabilitado explícito. No cambia consulta, página ni autorización.
- Reintento de errores con botón institucional y texto de contraste calculado; controles compartidos limitados al ancho de su tarjeta.

## Matriz que falta validar físicamente

UAT-45–46 quedan pendientes. No hay Android SDK/emulador en este entorno; la compilación y las pruebas de geometría no acreditan una revisión visual nativa.

| Prioridad | Comprobación | Aceptación |
|---|---|---|
| Alta | Android/iOS pequeños (320/360 puntos), medianos y tabletas (768/1024), vertical/horizontal | Sin recortes ni desplazamiento horizontal accidental; rotación conserva formulario y consulta |
| Alta | Notch, gestos, teclado y texto al 150/200 % | Se alcanza el último campo y las acciones; pestañas y botones legibles; ninguna altura fija recorta el contenido |
| Alta | TalkBack/VoiceOver en Login, materias, entrega, pagos, perfil | Orden lógico, nombres y estados de controles, foco y anuncios comprensibles |
| Alta | Red lenta, interrupción y reintento al entregar/descargar | No duplica entregas; distingue datos anteriores, vacío y fallo; archivos privados requieren sesión y conexión |
| Media | Nombres, materias y carreras largos; importes grandes, marca clara/oscura | Tarjetas crecen y contraste suficiente; no se reemplaza pendiente por cero |
| Media | Tareas, boleta y documentos con teclado abierto y vuelta desde otra app | Se conserva contexto; no se muestra un archivo de otra cuenta al cambiar sesión |

Antes de dar por terminada la app: instalar una compilación de prueba en dispositivos objetivo y recorrer esas filas con datos sintéticos y representantes autorizados. El siguiente ajuste debe partir de los recortes o fricciones observados, especialmente navegación con letra ampliada y formularios de entrega.

## Evidencia automatizada local

- Mobile: TypeScript sin errores; 128 pruebas Vitest y 11 Node aprobadas; exportación Android completada. Pruebas de geometría para anchos de teléfono/tableta, puntos fraccionarios y escalas de fuente de 1 a 3; no equivalen a capturas del renderizador nativo.
- Backend: lint sin errores (advertencias existentes), typecheck/build y 487 pruebas aprobadas. Web: lint sin errores (advertencias existentes), build y 232 pruebas aprobadas.
- Consistencia: 316 consultas cliente y 311 rutas API; versiones 1.27.55 → 1.27.56, beta/UAT y diff correctos.
- No se repiten localmente las integraciones de motores ni el smoke responsive web: esta entrega no cambia sus fuentes funcionales. CI debe validar el SHA final, incluidos los recorridos web corregidos en #203/#204.
