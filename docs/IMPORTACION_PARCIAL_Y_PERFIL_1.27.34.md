# 1.27.34 · Importación parcial y autogestión de contacto del alumno

## Alcance

Este PR se apila sobre #181 y #180. No instalar sin fusionar primero los dos PR anteriores.

### Alta masiva de alumnos

1. Descargar la plantilla desde `GET /api/importaciones/plantilla?tipo=ALUMNOS`. Requiere `correoInstitucional`, `correoProveedor`, `nombre` (primer nombre), `apellidoPaterno`, matrícula, CURP y plantel. `segundoNombre` es opcional y se concatena a `nombre` del expediente (sin columna nueva). Se conserva la cabecera `email` de archivos antiguos, **pero en este PR la selección de proveedor es obligatoria para todas las filas, incluidas las heredadas**.
2. `correoProveedor` debe ser Microsoft 365 o GoDaddy, aceptando los valores técnicos `MICROSOFT365` y `GODADDY`; sin valor se marca **fila inválida**, nunca se infiere silenciosamente el remitente.
3. Subir CSV/XLSX (500 filas/5 MiB). El backend revalida cada fila; devuelve `validos`, `duplicados`, `errores` con número de fila y mensaje. Duplicados por matrícula o correo institucional, incluyendo cuentas eliminadas lógicamente, se **omiten** y se informan; no se reactivan ni sobrescriben. Filas incompletas o inválidas no impiden la incorporación de las válidas.
4. El usuario revisa los resultados y **confirma** la carga de nuevas cuentas válidas. El backend vuelve a verificar, en transacción serializable, y crea únicamente las que siguen siendo válidas. Devuelve `total`, `insertados`, `existentes`, `rechazados`. Un fallo de infraestructura o una carrera de escritura imprevista sigue haciendo rollback; no se presenta como éxito parcial silencioso.
5. `GET /api/importaciones/correcciones/:previewId` devuelve un Excel para el **mismo actor** dentro de 15 minutos: hoja `ALUMNOS` con las filas inválidas y sus columnas originales, hoja `Errores` con razones y fila de origen. No incluye alumnos existentes/duplicados; respeta el límite, los permisos y el preview cifrado existente. El portal permite descargarlo antes de confirmar y lo descarga automáticamente si se confirma un lote con errores. Tras confirmar, el preview es consumido: el fichero correctivo debe guardarse antes.
6. No son jobs persistentes. Las peticiones usan `Promise` y estado de carga en React, de modo que la interfaz muestra avance por etapas y el resto del portal puede navegarse. Si se cierra/reinicia la pestaña durante la petición no hay monitor persistente ni barra de porcentaje real; verificar resultados antes de subir de nuevo. **No se inventa infraestructura de cola**.

### Perfil propio en app Expo y portal web

Ruta backend: `PATCH /api/alumnos/me/perfil`, JWT y guard `ALUMNO`, identifica al titular mediante `user.sub` (sin ID manipulable), comprueba expediente activo y actualiza únicamente:
- `correoPersonal` (contacto; no se utiliza para OTP o recuperación).
- `fechaNacimiento` (formato AAAA-MM-DD).
- `telefono`.
- `tutorNombre`.
- `tutorTelefono`.
- `direccion`.

Nombre, CURP, matrícula, correo institucional, proveedor de correo, plantel, rol, estado y calificaciones **no son editables** por el alumno. Valores vacíos de contacto se guardan como nulos; el formulario conserva entradas si la API falla. Los datos se consultan con el `GET /api/alumnos/me/perfil` existente, ampliado; no hace falta modificar reglas de negocio en web ni Expo.

### Auditoría de alcance y riesgos

| Severidad | Hallazgo | Impacto | Corrección / estado |
| --- | --- | --- | --- |
| Alta | `importaciones.service.ts`: previews anteriores impedían aceptar nuevas cuentas si una fila estaba duplicada o incompleta. | Lotes inutilizables y reintentos propensos a duplicados. | Clasificación por fila, confirmación transaccional sólo de válidas y resumen. |
| Alta | Preferencia de remitente sin seleccionar en la carga; #181 infería Microsoft. | Envío desde un servicio que quizá no entrega al buzón. | Rechazar la fila sin proveedor; lista XLSX obligatoria. |
| Media | Plantilla usaba un solo campo `nombre` para uno o varios nombres. | Captura confusa de segundo nombre. | `nombre` obligatorio y `segundoNombre` opcional, compuesto en backend. |
| Media | No había Excel de sólo incidencias. | Retrabajo manual de hasta 500 filas. | Endpoint privado de descarga, hoja con causas, 15 min. |
| Alta | El alumno no podía actualizar su propia información de contacto. | Datos obsoletos y solicitudes a administrativos. | Ruta acotada y formulario web/Expo sólo para ALUMNO. |
| Media (pendiente) | El lote sigue siendo HTTP síncrono y hashing de hasta 500 usuarios consume CPU; no existe seguimiento de trabajos durables. | Tiempo alto o petición cortada en redes inestables. | UI no bloqueante y límite de 500; cola persistente con estado/reanudación requeriría propuesta posterior. |
| Alta (pendiente operativa) | Dominio institucional en dos proveedores, sin solución de ruta cruzada. | Correo aceptado puede no llegar. | Probar selección de remitente, entrega y enrutamiento antes de habilitar Graph; no tocar MX. |

### Verificación

- CI backend: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- CI web: `npm run lint`, `npm test`, `npm run build`.
- CI Expo: `npm test`, `npx tsc --noEmit`, export Android.
- Integración MySQL/SQL Server + UAT institucional: 10 filas, 9 existentes + 1 nuevo, 1 inválido + 1 nuevo, todos duplicados, dos registros con el mismo correo/matrícula, restricciones por plantel, curso y regreso al portal tras navegación.
- No se realizan cambios destructivos; no se agrega ninguna dependencia.
