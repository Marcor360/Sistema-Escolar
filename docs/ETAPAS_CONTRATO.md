# Mapeo contra el Anexo A del contrato

| Etapa | Entregable del contrato | Dónde queda cubierto |
|---|---|---|
| **Mes 1** | Arquitectura, BD inicial, roles, login, recuperación de contraseña, sesiones, permisos, estructura base de backend/web/app | `docs/ARQUITECTURA.md`, `database/`, módulo `auth` (JWT + reset), guard de roles, monorepo completo |
| **Mes 2** | Panel maestro: grupos/materias asignadas, actividades, captura de calificaciones, materiales, calendario, historial | `/academico/mis-grupos`, módulo `actividades` (CRUD + materiales con límites de formato/peso), `calificaciones/captura`, módulo `calendario`, página web **Mis clases** |
| **Mes 3** | App/portal alumno: materias, tareas, entrega con archivos, calificaciones, notificaciones, perfil, estado financiero básico | App Expo (5 pestañas), endpoints `me/*`, entrega multipart, `/finanzas/me/estado-cuenta` |
| **Mes 4** | Gestión de alumnos/docentes/grupos/materias, asignaciones, boletas PDF, exportación Excel, reportes básicos | Módulos `alumnos`, `docentes`, `academico`; `/reportes/boleta/:id` (PDF), `/reportes/adeudos.xlsx`, `/reportes/resumen`; páginas web correspondientes |
| **Mes 5** | Pagos manuales, estado de cuenta, conceptos (inscripción/colegiatura/recargo/descuento/beca), adeudos, correos de cobranza, plantillas, bitácora financiera, integración Openpay con webhooks, QA, permisos, bitácora de actividad | Módulo `finanzas` completo, `openpay.service.ts`, webhook, plantilla `AVISO_ADEUDO`, bitácoras, guards por rol validados |
| **Mes 6** | Versión productiva, publicación en tiendas, capacitación, migración inicial, documentación | `npm run build` en backend/web; `app.json` con bundle ids listos para EAS; esta documentación. La publicación requiere cuentas y accesos del cliente (ver abajo) |

## Dependencias que corresponden al cliente (según contrato)

- Credenciales **Openpay/BBVA** de sandbox y producción (cláusula DÉCIMA).
- Cuenta **SMTP** para correos transaccionales.
- Cuentas **Google Play Console** y **Apple Developer** para publicar (Mes 6).
- Dominio, hosting/nube y certificados.
- Identidad visual, textos legales y aviso de privacidad.
- Información estructurada de alumnos/maestros/grupos para la migración inicial.

## Fuera de alcance (sin cambios)

Facturación electrónica/SAT, conciliación bancaria, segunda pasarela, chat en
tiempo real, modo offline, antiplagio y demás exclusiones de la cláusula TERCERA
permanecen fuera de este MVP.
