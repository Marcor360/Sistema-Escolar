# Requerimiento de siguiente fase: biblioteca institucional, calendario, móvil y recuperación

**Estado:** especificación técnica inicial para despliegue progresivo. **No es implementación, auditoría exhaustiva ni certificación de producción.**
**Base observada:** `main` documenta versión candidata 1.23.0 (12/oct/2026). Definir la siguiente versión funcional al integrar las ramas; si se incorporan capacidades retrocompatibles y 1.23.0 sigue siendo la base, candidata 1.24.0. No publicar un cambio de versión por documentación.

## 1. Resumen del repositorio revisado

- API NestJS/TypeORM es la única capa de reglas y acceso a MySQL/SQL Server. Web React/Vite para gestión institucional; app Expo únicamente ALUMNO.
- Archivos actuales: `backend/src/archivos/archivos.controller.ts` resuelve enlaces firmados de materiales y entregas. `backend/src/configuracion/configuracion.controller.ts` ya permite subir/quitar logo y `configuracion.service.ts` programa la limpieza posterior al cambio. `backend/src/common/uploads-path.ts` obtiene `UPLOADS_DIR`.
- Calendario: `backend/src/calendario/calendario.controller.ts` expone GET/POST/DELETE y NO PATCH. `web/src/pages/Calendario.tsx` muestra consulta, alta, eliminación y filtros. `mobile/src/screens/Inicio.tsx` consulta `/calendario`.
- Móvil: `mobile/src/api/client.ts` configura URL desde Expo, axios y `x-portal: MOVIL`, renueva access con refresh guardado en SecureStore; `mobile/App.tsx` guarda sesión y **cachea marca**, pero no demuestra caché persistente para datos académicos. Inicio solicita tareas, saldo, avisos y calendario al enfocar.
- Contraseña: `backend/src/auth/auth.controller.ts` ofrece forgot/reset con rate limit; `backend/src/auth/auth.service.ts` genera token de 1 h (solo hash en BD) y llama a `notificaciones.enviarEmail`; si hay error de entrega lo registra y devuelve respuesta genérica. Se debe probar explícitamente el caso SMTP no configurado sin exponer cuentas ni tokens.

## 2. Biblioteca de archivos institucionales (nuevo alcance)

**No confundir carpeta de servidor con permisos de usuario:** estructurar el almacenamiento físico bajo `UPLOADS_DIR` y representar carpetas lógicas autorizadas en API/BD solo si se confirma su necesidad.

Propuesta lógica (nombres tentativos; NO son rutas existentes ni endpoints):
- `institucion/marca/`: logo oficial, fotografías de identidad institucional y variantes
- `planteles/{id}/logos/`, `planteles/{id}/fotografias/`
- `planteles/{id}/calendarios/{cicloId}/`: PDFs e imágenes de calendarios
- `alumnos/{id}/`: **solo si el requisito real justifica expediente digital**; privado, cifrado/ACL y acceso por alcance
- materiales/entregas: **conservar las rutas y permisos actuales**, sin migración implícita ni exposición pública

**Operaciones de interfaz**: biblioteca en web con carpetas, cargar, vista previa, renombrar referencia, archivar/eliminar lógico, versión, búsqueda y filtrado por plantel/ciclo. Exponer solo categorías autorizadas; evitar aceptar rutas arbitrarias del cliente, traversal, symlinks y nombres físicos elegidos por usuario. Registrar propietario, visibilidad, MIME validado por firma, límite de peso, hash, actor y fecha. Generar nombre aleatorio y autorización en cada lectura y descarga. Política de retención y cuotas configurables. Logos y calendarios públicos solo cuando el propietario los marque expresamente como públicos; expedientes siempre privados.

**Infraestructura Windows/IIS**: directorio `UPLOADS_DIR` persistente fuera del árbol publicado por IIS; ACL de escritura solo para servicio API, respaldo y restauración, antivirus/escaneo según entorno, URLs resueltas por API, no listar carpetas físicas. No usar la BD para bytes de imágenes salvo decisión justificada. Verificar que la inicialización cree directorios y que errores de subida no dejen archivos huérfanos. Mantener compatibilidad MySQL/SQL Server con migraciones espejo cuando haga falta metadata.

## 3. Calendario escolar

- Añadir capacidad de **editar** evento existente en API y web reutilizando servicio y DTO; prohibir edición en ciclo cerrado cuando corresponda, validar pertenencia a plantel/grupo, permisos del autor, intervalos/zonas horarias y concurrencia.
- Seleccionar ciclo, plantel, grupo, tipo, fecha de inicio y fin; vista mensual/semanal/lista, eventos multidiarios, estados vacío/error/cargando.
- Soportar archivo PDF/imagen de calendario institucional como documento de biblioteca ligado al ciclo, **sin sustituir los eventos estructurados**.
- Alumno: consulta **solo** eventos visibles para sus grupos/plantel y ciclo actual, junto con histórico explícito cuando esté permitido. Sin creación o gestión administrativa desde Expo.
- Pruebas: cambios y borrado simultáneo, cambio de ciclo, límites de medianoche, horario local, duplicados, permisos múltiples, accesibilidad y exportación si se implementa.

## 4. App del ALUMNO: sincronización, caché y captura

- La app **no se conecta directamente a la base de datos**; consulta API NestJS por HTTPS. No incorporar credenciales MySQL en Expo ni endpoints administrativos.
- Inventario de vistas: inicio, materias, tareas, calificaciones, estado de cuenta, perfil, avisos, eventos y adjuntos. Mapear API/pantalla/estados en una matriz y probar flujo de cuenta real de staging.
- Definir caché de solo lectura por clave `usuario + sesión + rol + plantel + ciclo + recurso`; nunca datos académicos compartidos entre usuarios. TTL, stale-while-revalidate, invalidación al cerrar sesión/cambiar credenciales/ciclo/plantel y manejo sin red. Guardar secretos exclusivamente en SecureStore. Evaluar almacenamiento cifrado de datos sensibles y capacidad offline según impacto y peso; no guardar calificaciones/tutor/datos financieros en caché plano.
- Para envío de tareas/adjuntos: cola de pendientes **solo si** se define idempotencia de servidor y estados PENDIENTE/ENVIANDO/CONFIRMADO/ERROR; nunca asegurar que se entregó antes de respuesta de API. Evitar doble envío/reintentos duplicados. Para edición de datos personales definir alcance ALUMNO y autorización API explícita.
- Revisar formato de fechas y uso de `toISOString()` en `mobile/src/screens/Inicio.tsx` frente a intervalos escolares locales, sin presumir fallo hasta ejecutar casos de borde.
- Notificaciones push: continuar deshabilitadas por defecto hasta probar permisos, token, FCM/APNs y dispositivos físicos; no incluir calificaciones/datos de menores en pantalla bloqueada.

## 5. Recuperación de contraseña sin correo oficial

- **No inventar ni registrar email remitente oficial.** Mantener variables de SMTP sin valores sensibles y no habilitar envío real mientras no esté configurado.
- Implementar ensayos con transporte SMTP simulado: correo registrado/no registrado, rate limit, token expirado/usado, replay, cambio de contraseña, revocación de sesiones, límites de longitud y entrega fallida.
- `auth.service.ts` actualmente guarda el token antes de intentar correo; revisar estrategia de solicitud cuando transporte no está configurado para que el sistema no prometa recuperación entregada. Respuestas externas uniformes por privacidad, telemetría interna sin token/correo en claro.
- Si hace falta recuperación operativa antes de SMTP, diseñar **restablecimiento administrativo excepcional** con verificación de identidad, actor, motivo, contraseña temporal y cambio obligatorio; no mostrar tokens desde endpoints públicos ni logs.

## 6. Riesgos / hallazgos verificables en código

| Código | Archivo y evidencia | Severidad | Impacto y acción |
| --- | --- | --- | --- |
| CAL-01 | `backend/src/calendario/calendario.controller.ts`: GET/POST/DELETE, no PATCH | Media | Falta editar evento; agregar caso de uso con scopes/DTO/pruebas |
| ARC-01 | `backend/src/configuracion/logo-upload.config.ts`: destino `uploadsPath()`, nombre aleatorio de marca | Media (funcional) | No existe biblioteca por carpetas visible; crear modelo lógico y control de permisos, preservar logos existentes |
| MOB-01 | `mobile/App.tsx`: caché de marca; `mobile/src/screens/Inicio.tsx`: consultas al enfocar | Media (resiliencia) | No se acreditó caché académica persistente; diseñar y ensayar offline por identidad |
| AUT-01 | `backend/src/auth/auth.service.ts` `forgotPassword`: guarda token y captura fallo al enviar | Media (operativa) | Probar ausencia de SMTP y no fingir entregas; proteger uniformidad de respuestas |
| OPS-01 | README 1.23.0: piloto y pruebas físicas pendientes | Alta (release) | No declarar app o despliegue listo hasta certificar entorno, dispositivos y matriz de regresión |

Clasificación preliminar basada en lectura estática, no prueba de explotación. Faltan líneas estables de hallazgos tras sincronizar base y ejecutar auditoría completa.

## 7. Implementación por partes dentro de esta iniciativa

A. **Almacenamiento/biblioteca**: inventario del `uploads` real; permisos y metadata; UI web; migraciones espejo solo si se requieren; tests de path traversal, ACL, límites, eliminación y recuperación.
B. **Calendario**: PATCH protegido y edición web, archivo calendario vinculado a ciclo/plantel; pruebas en fechas, roles e historial.
C. **Expo alumno**: caché segura acotada por identidad/contexto, invalidaciones, uso offline, sincronización y confirmación de entregas; no incluir otros roles.
D. **Recuperación y gate de despliegue**: pruebas SMTP simulado y escenarios reales solo con cuenta institucional configurada; QA integral y matriz de operación.

Cada bloque con commits diferenciados y, si crece el alcance, PR independientes encadenados para revisión segura. Esta rama **solo aprueba requisitos**, no incrementa versión ni promete código funcional.

## 8. Gate para desplegar

- CI verde del SHA definitivo; lint/typecheck/build/tests backend/web/mobile.
- Pruebas de integración con API y DB reales en MySQL y SQL Server; migraciones espejo y rollback ensayado.
- Matriz de usuarios: ALUMNO, MAESTRO, ADMINISTRATIVO, FINANZAS, SUPERADMIN y cuentas multirrol. Negativas de lectura/edición fuera de plantel/grupo.
- Pruebas manuales Android/iOS, reconexión, expiración de token, cambio de usuario, eliminación de caché, redes inestables y reintentos.
- Almacenamiento/ACL/IIS, backups restaurados, SMTP sin configurar, firmas de archivos y tamaño.
- Accesibilidad WCAG AA, teclado/lector de pantalla y mensajes español.
- Reporte final de rutas/líneas, comandos ejecutados, resultados, riesgos y rollback. **No marcar terminado sin evidencias.**
