# Portal del alumno · referencia visual UTC

Cambio sobre la base `93e7b2a`, con las correcciones de acceso previo y tareas del mismo espacio de trabajo. Implementado localmente; no desplegado.

## Criterio visual

Las capturas de UTC se usan como referencia de jerarquía y distribución: cabecera blanca con identidad del alumno, menú lateral plegable, saludo con matrícula, servicios en tarjetas y secciones consistentes. Se conservan la marca configurable y las funciones disponibles del sistema escolar.

- En escritorio, el menú mide 88 puntos plegado y 264 desplegado; el contenido se adapta al espacio restante.
- En celular y tableta hay navegación inferior y un menú completo con cierre mediante Escape, botón o fondo; al cerrar se devuelve el foco al botón de apertura.
- Inicio prioriza aula, finanzas y ventanilla, con accesos a calendario, avance académico y perfil. Los pendientes, boletas, avisos y eventos siguen disponibles.
- Calendario y ventanilla tienen accesos independientes a los componentes existentes. No se anuncian biblioteca, chat, tarjetas guardadas o facturación sin servicios disponibles para el alumno.
- Finanzas muestra saldo, cargos pendientes y pagos registrados por la API. Se conservan las confirmaciones de pago y la revalidación del saldo.
- La entrega web adjunta el objeto File del selector; Android conserva su URI local. No se descargan archivos desde URLs proporcionadas por el usuario.
- Las tarjetas se distribuyen en una, dos o tres columnas según ancho disponible y tamaño de fuente. La paginación se oculta cuando solo hay una página.

## Archivos principales

`mobile/App.tsx`, `mobile/src/components/PortalAlumno.tsx`, `mobile/src/components/IconoAlumno.tsx`, `mobile/src/portal-alumno.ts`, `mobile/src/screens/Inicio.tsx`, `mobile/src/screens/ServiciosAlumno.tsx`, `mobile/src/screens/EstadoCuenta.tsx`, `mobile/src/screens/Calificaciones.tsx`, `mobile/src/screens/Tareas.tsx` y los tokens/componentes compartidos del alumno.

Sin cambios nuevos de esquema ni reglas de autorización. La identidad mostrada proviene de la sesión y del perfil propio, y se limpia al cambiar de alumno.

## Verificación local

- `cd mobile && npx tsc --noEmit`: aprobado.
- `cd mobile && npm test`: 148 pruebas Vitest y 11 comprobaciones Node aprobadas.
- Exportación Expo web con API de prueba: aprobada.
- `CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:web` con anchos 320, 360, 768, 1280 y 1920: aprobado. Incluye geometría del menú, Escape y foco, ventanilla, archivo multipart con nombre/contenido reales, boletas, perfil y cierre de sesión. API simulada y datos sintéticos.
- Exportación Expo Android: aprobada. No acredita instalación o prueba física de Android/iOS.
- `git diff --check`: aprobado.

Pendiente publicar el portal, distribuir la app y validar la experiencia con los dispositivos y servicios institucionales.
