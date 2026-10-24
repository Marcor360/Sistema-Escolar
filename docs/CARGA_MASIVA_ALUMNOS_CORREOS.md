# 1.27.33 · Carga masiva de alumnos: correo institucional, personal y remitente

## Contrato de la plantilla XLSX

La descarga existente `GET /api/importaciones/plantilla?tipo=ALUMNOS` genera la hoja **ALUMNOS** con las columnas:
`correoInstitucional`, `correoPersonal`, `correoProveedor`, `nombre`, `apellidoPaterno`, `apellidoMaterno`, `matricula`, `plantelId`, `curp`, `fechaNacimiento`, `telefono`, `tutorNombre`, `tutorTelefono`, `direccion`.

- **correoInstitucional**: requerido, identificador único de la cuenta (`usuarios.email`), destino de activación, recuperación y avisos según los flujos ya existentes. **No se crea un buzón** en Microsoft o GoDaddy: el buzón debe existir y estar operativo.
- **correoPersonal**: opcional, correo de contacto alternativo (`usuarios.correo_personal`); **no** interviene en autenticación, recuperación ni envíos automáticos (protección ante divulgación de credenciales a terceros).
- **correoProveedor**: selector desplegable por alumno: **Microsoft 365** o **GoDaddy**. Si queda vacío, el backend determina **MICROSOFT365**. Los valores técnicos `MICROSOFT365` y `GODADDY` también se aceptan para CSV. Es el **servicio remitente**, no el dominio ni el tipo de buzón creado.
- Las demás columnas y reglas (CURP, matrícula, plantelId, longitud, alcance y estados) se conservan.
- **Compatibilidad**: CSV/XLSX heredados con columna `email` continúan aceptándose para ALUMNOS; si se proporciona `email` y `correoInstitucional`, los dos deben coincidir. En la plantilla nueva solo se muestra `correoInstitucional`.

**Importación**: máximo **500 filas**, **5 MB**, sin fórmulas. La plantilla generada no trae filas de alumnos ficticios. Se conserva la previsualización cifrada por usuario, caducidad de 15 minutos y confirmación serializable del lote, revalidando permisos, duplicados, rol y plantel.

## Ejemplo lógico, no incluido como fila precargada

| correoInstitucional | correoPersonal | correoProveedor |
| --- | --- | --- |
| alumno@iua.edu.mx | alumno.personal@example.com | Microsoft 365 |
| otro@iua.edu.mx | | GoDaddy |

La dirección `email` existente no se cambia en los expedientes ya registrados. `correoPersonal` permite el mismo correo de familiar/tutor para más de un expediente; por ello no es índice único.

## Requisitos para activar

1. Integrar y validar **PR #180 primero**, ya que contiene `usuarios.correo_proveedor` y la integración Graph/GoDaddy. Este PR es **dependiente** y apunta a la rama de #180; no mezclarlo directamente contra `main` sin rebase.
2. Respaldar ambas bases y aplicar únicamente el runner de migraciones (espejos MySQL y SQL Server). La nueva columna es nullable; no sobrescribe emails existentes. No ejecutar SQL `schema.sql` ni activar `DB_SYNC` en producción.
3. Confirmar si el correo institucional de cada fila **existe realmente en el proveedor que entrega**. Un remitente Microsoft y un buzón GoDaddy del mismo dominio pueden no comunicarse en la arquitectura actual. La selección de proveedor no reemplaza el arreglo de coexistencia del dominio.
4. Verificar ACL de la clave privada Graph en Windows/IIS y configuración SMTP de GoDaddy. Si Graph sigue deshabilitado, las cuentas seleccionadas como Microsoft **no deben redirigirse silenciosamente a GoDaddy**.
5. UAT de alta por XLSX, alta por CSV heredado, validación de correos inválidos, email repetido, encabezados conflictivos, proveedor desconocido, lote mixto y reversión íntegra si alguna fila falla. Comprobar que códigos de recuperación nunca van al correo personal.
6. Controlar acceso web/API a datos personales de menores: alcance por plantel, contraseñas nunca en archivos, preview cifrado, ausencia de PII en bitácoras.

## Hallazgos de auditoría de este flujo

| Severidad | Hallazgo / evidencia | Impacto | Corrección |
| --- | --- | --- | --- |
| Alta | `backend/src/importaciones/importaciones.service.ts` crea `Usuario` directamente, sin pasar por el alta individual de `UsuariosService`, y antes no persistía `correoProveedor`. | El alumno importado podía usar el remitente GoDaddy del valor por defecto de BD, aunque su alta individual usase Microsoft. | Persistir `correoProveedor` en la confirmación del lote, con default por rol y validación de DTO. |
| Media | `backend/src/importaciones/plantillas.ts` solo ofrecía `email`, sin distinguir correo personal e institucional. | Captura ambigua de destinatario y contacto. | Columnas explícitas, guía y lista de selección; `email` queda solo para archivos antiguos. |
| Media | `backend/src/alumnos/alumnos.dto.ts` y entidad `Usuario` no almacenaban el correo de contacto opcional. | Pérdida de información de contacto / reingreso manual. | Nuevo campo nullable, migraciones en ambos motores y edición web. |
| Alta (pendiente operativa) | El dominio `iua.edu.mx` es compartido entre Microsoft 365 y cPanel; los envíos internos entre proveedores no están resueltos. | El correo puede aceptarse en el proveedor y no llegar al destinatario. | UAT con buzones reales y resolución del enrutamiento de dominio fuera de este PR; no cambiar registros MX aquí. |
| Media (pendiente operativa) | Correos personales de menores son datos sensibles; un contacto compartido puede pertenecer a tutor/familia. | Riesgo de exposición de códigos si se usan como destino. | Guardarlos solo como contacto; nunca enviar códigos o contraseñas a esa dirección sin flujo institucional aprobado. |

## No incluido

No se crean cuentas de correo en Microsoft/GoDaddy, no se modifican registros DNS, no se cambia la política de enrolamiento/cartera, ni se añaden pantallas administrativas a Expo. Los certificados privados no forman parte del repositorio ni de la plantilla.

## Pruebas

`cd backend && npm run lint && npm run typecheck && npm test && npm run build`
`cd web && npm run lint && npm test && npm run build`

El responsable de despliegue debe completar la UAT de ambos motores y revisar los estados de GitHub Actions **antes de fusionar**.
