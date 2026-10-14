# Barrido exclusivo de Expo · alumno · 14 de octubre de 2026

**Repositorio y rama base:** `main`, candidato `1.24.0-beta.2` (revisión estática de `mobile/` y lectura de contratos existentes de la API). **Ámbito de cambios:** exclusivamente `mobile/`. Los clientes web, módulos administrativos, MySQL/SQL Server, migraciones y despliegue NO se modifican.

## Arquitectura corroborada

- `mobile/App.tsx`: seis pestañas exclusivamente del alumno; Perfil ahora contiene navegación interna a «Mis documentos», sin agregar una séptima pestaña.
- `mobile/src/api/client.ts` y `config.ts`: API NestJS vía `EXPO_PUBLIC_API_URL`, HTTPS en preview/producción, sesión con SecureStore y refresh rotativo; no conexión directa a base de datos.
- `mobile/src/api/cache-academica.ts`: copia SOLO en memoria por identidad, con máximo cinco minutos desde lectura exitosa; ante fallo de red devuelve la última lectura elegible, no respuestas de permisos/401. Nunca persiste calificaciones en un directorio del teléfono.
- `backend/src/reportes/boleta-movil.controller.ts`: `GET /api/reportes/mis-boletas` y `GET /api/reportes/mi-boleta/enlace`. El PDF se genera en backend; enlace firmado para el alumno (dos minutos).
- `backend/src/actividades/actividades.controller.ts`: `GET /api/grupo-materias/:id/materiales` y `GET /api/archivos/materiales/:id/enlace`. El listado no es una carpeta física, es contenido de la materia autorizada.

## Hallazgos y ejecución

| Severidad | Hallazgo (archivo) | Impacto | Corrección o decisión |
| --- | --- | --- | --- |
| Alta | `mobile/src/screens/Materias.tsx`: el botón para abrir un archivo se encontraba anidado dentro del botón para expandir la materia. | Pulsaciones contradictorias, posibles cierres y peticiones que se descartan. | Separados: la carpeta se expande en su propio control, los archivos tienen controles independientes. |
| Alta | `mobile/src/screens/Calificaciones.tsx`, `Materias.tsx`: apertura con concatenación directa de cualquier `url` de la respuesta API. | Sin validación en el cliente del origen y ruta autorizados antes de abrir enlaces. | Nuevo `api/enlaces-privados.ts`: restringe al origen y rutas firmadas de boleta/material. Tests de URLs externas, parámetros ajenos y material distinto. |
| Alta | `mobile/App.tsx`: la navegación no incluía una clave por identidad explícita. | En cambios de identidad sin desmontar la aplicación, el estado previo de pestañas podría permanecer hasta nueva carga. | El navegador de pestañas se remonta con `key={sesion.sub}`; además, el nuevo centro invalida las lecturas de sesión anterior. |
| Media | No existía una vista unificada del alumno para localizar boletas históricas y materiales agrupados. | Documentos repartidos por vistas y sin catálogo accesible desde Perfil. | Nueva vista `screens/Documentos.tsx`: boletas por ciclo e inscripción, carpetas de materiales por asignatura, carga y errores por sección, reintento, lectura temporal de índices y enlaces al solicitarlos. |
| Media | `mobile/src/screens/Materias.tsx`: al cambiar de alumno se limpiaban registros, pero no siempre las banderas de copia offline/expiración. | Advertencias temporales confusas para cuenta nueva. | Se reinician indicadores por identidad. |
| Media | `mobile/src/screens/Tareas.tsx`: no validaba extensión, nombre o peso del archivo antes de transferir. | Consumo de red innecesario y rechazo tardío por el servidor. | Prevalidación y explicación de formatos; servidor mantiene autoridad de límites y MIME. |
| Pendiente | `mobile/src/screens/Calificaciones.tsx`: PDF ya se genera en backend pero el móvil abre `Linking.openURL` en app externa. | Abrir un PDF no es garantía de que se haya guardado en el dispositivo o exportado a una carpeta local. | Requiere probar Android/iOS físicos. No implementar almacenamiento local de documentos sensibles sin cifrado, caducidad, permisos y revisión de UX. |
| Pendiente | `mobile/src/screens/Perfil.tsx`: datos personales como CURP visibles cuando se consulta perfil. | Privacidad en dispositivo compartido/capturas. | Evaluar ocultar campos sensibles hasta pulsar «mostrar» y política de capturas; no guardar copia extra de ficha. |
| Pendiente | `mobile/src/screens/Inicio.tsx`, `Tareas.tsx`, `EstadoCuenta.tsx`: datos en memoria de pantalla con tratamiento heterogéneo de error/reconexión. | No todas las pantallas tienen comportamiento offline unificado. | PR específico de estados de red y revalidación, sin almacenar estado financiero/entregas en cache persistente. |
| Pendiente | `mobile/src/screens/Tareas.tsx`: no hay cola offline ni idempotencia de entregas desde la app. | Reintentar tras timeout de una subida puede duplicar incertidumbre. | No agregar cola hasta que se defina contrato de idempotencia en el backend; nunca marcar «entregado» localmente. |
| Pendiente | `mobile/src/push.ts`: integración preparada con EAS y consentimiento. | No se ha certificado push nativo en equipos físicos. | Probar opt-in, opt-out, tokens, cambio de alumno y notificación con teléfono bloqueado. |

## Qué significa «carpetas» y «plantillas»

- Las **carpetas de materias** son agrupaciones visuales de los recursos que el maestro ya publicó y a los cuales ALUMNO tiene permiso. No crean ni administran carpetas de biblioteca del servidor.
- Las **boletas** siguen utilizando exclusivamente la plantilla PDF que genera el backend; no se inventa una plantilla ni se genera un PDF diferente en el teléfono. Se listan inscripciones propias para distinguir traslados y ciclos.
- Una **ficha informativa descargable, constancias u otras plantillas institucionales** no tienen contrato de API confirmado para ALUMNO en esta auditoría. La información de perfil ya existe en la app, pero no se presenta como documento oficial. Si se requiere descarga, diseñar su contrato y la autorización en el backend, sin incluir gestión en Expo.
- El índice de boletas/materias/materiales puede ofrecer copia en memoria por cinco minutos. **Los bytes de PDF, archivos adjuntos y tokens de enlace firmado no se almacenan ni se cachean**. Los enlaces se solicitan nuevos en cada apertura.

## Aceptación y límites

- En CI exigir `cd mobile && npm test && npx tsc --noEmit && npx expo export --platform android`, además de los jobs completos del PR (aunque solo se modifique móvil).
- Verificar en dos dispositivos físicos (Android e iOS): navegación Perfil → Documentos → volver; ciclo y traslado, carpeta vacía, material PDF real, archivo no accesible, red intermitente, expiración de copia y cambio de alumno en el mismo dispositivo.
- Probar abrir/compartir/guardar el PDF en cada sistema operativo **sin asumir que `Linking.openURL` ofrece descarga nativa**.
- No se ha probado una base institucional, servidor IIS, ClamAV, SMTP, ni un dispositivo físico desde GitHub. Mantener PR sin fusionar hasta evidencias.
