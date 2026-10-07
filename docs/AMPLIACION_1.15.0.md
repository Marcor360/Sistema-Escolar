# Ampliación de código y verificación — 1.15.0

Fecha: 7 de octubre de 2026. Base publicada: `a2c1df62447476b970c7404ed3128fb83bb49598`. El commit conserva el nombre y versión candidata **1.15.0** e incluye el resumen de estos cambios en su cuerpo. Su SHA y ejecución exacta se entregan al publicar; la [CI](https://github.com/Marcor360/Sistema-Escolar/actions/workflows/ci.yml) debe corresponder al nuevo SHA. Este documento no aprueba la salida del piloto.

## Cambios realizados

- Ciclos: preparación sin desplazar el vigente; activación, inicio de cierre y cierre explícitos. El cierre exige P1-P3 completos y cerrados; grupos inscritos sin materias impiden iniciar el cierre. Captura y cierre bloquean el mismo ciclo. Los grupos pueden prepararse antes de activar el ciclo.
- Promoción: selección explícita de alumnos desde un ciclo cerrado a uno futuro en preparación, mismo plantel, preview y confirmación atómica. Se conserva el histórico y no se copian notas ni se permiten inscripciones duplicadas.
- Importación: plantillas CSV/XLSX de alumnos, docentes, personal e inscripciones; alcance por plantel, errores por fila, duplicados y límites de archivo/filas/descompresión. No se aceptan fórmulas ni columnas de contraseñas. El preview dura 15 minutos, pertenece al actor y se vuelve a validar dentro de una transacción: un fallo revierte todo. No se muestran credenciales; activación mediante recuperación de contraseña o restablecimiento temporal autorizado con cambio inicial obligatorio. La recuperación necesita SMTP operativo.
- Identidad: reactivación explícita de BAJA con motivo y usuario coherente, sin restaurar clases/inscripciones anteriores. EGRESADO no pasa a BAJA para eludir esa restricción. Reactivación docente exige planteles activos; las clases quedan pendientes de reasignación. Edición de personal exige alcance y revoca sesiones al cambiar roles/planteles. El PATCH genérico no cambia roles evitando esa validación. Se minimiza el correo del alumno en listados de docentes/Finanzas.
- Bitácora: transiciones, inscripción, reasignación, promoción e importación registradas; consulta web paginada y alcance de plantel. Los detalles evitan copiar expedientes o notas privadas.
- Actividades/materiales: edición y desactivación en web, comentarios de entrega y retroalimentación en móvil, fecha corregible, títulos/descripciones acotados. Borrar materiales y sustituir entregas persiste una tarea de limpieza junto con la transacción; se borra después del commit y un fallo de disco se reintenta sin perder la referencia. Un DTO inválido también retira el archivo recién subido. La reentrega calificada sigue bloqueada.
- Finanzas: conceptos editables y desactivables; `aplicaRecargo=false` por defecto, conforme a la regla aceptada. Recargo solo en conceptos activos habilitados y sobre monto menos descuento, una vez por cargo. BECA/DESCUENTO/RECARGO no se crean como deuda positiva; descuentos reducen el cargo. Pago manual requiere cargo. Colegiaturas excluyen alumnos/usuarios inactivos y vuelven a comprobar ciclo, alumno, inscripción, concepto y alcance al guardar, bajo bloqueos. Se mantienen idempotencia, auditoría, preview y confirmación por plantel.
- Sesiones: limpieza periódica de sesiones que expiraron hace más de 30 días; la expiración/revocación ya rechaza el acceso inmediatamente. Se conserva refresh rotativo, acceso de 15 minutos y SecureStore.
- Catálogos: créditos pueden ser cero; formularios preservan datos tras errores y no activan ciclos implícitamente; búsquedas de grupos paginadas por contexto.

## Push notifications

Registro voluntario exclusivo de ALUMNO, ligado a instalación y sesión. El consentimiento se guarda en SecureStore; no se solicita permiso automáticamente. Cerrar sesión revoca la sesión y limpia avisos del sistema. El worker valida usuario/dispositivo/sesión antes de enviar, evita envíos duplicados por notificación/dispositivo, reintenta fallos y consulta recibos; desactiva tokens no registrados. El payload es genérico, sin notas, adeudos ni incidencias en pantalla bloqueada. Pulsar abre Inicio para consultar la información autorizada en la app.

`PUSH_ENABLED=false` por defecto. Para activar: proyecto EAS, identificador público de proyecto en móvil, configuración FCM/APNs y, si procede, `EXPO_ACCESS_TOKEN` privado en backend. Un recibo del proveedor no prueba que el alumno lo leyó ni certifica entrega física. Las pruebas usan respuestas simuladas del proveedor; falta probar la entrega en un teléfono firmado.

## Conducta/incidencias: solo personal interno

Registro por alumno/grupo vigente; tipo, gravedad, descripción y fecha validados. Seguimiento append-only con notas, motivo y cambio de estado; control escolar cierra/anula, mientras docente registra/sigue sus clases. Cierre/anulación conserva historial. Administrativo opera dentro de sus planteles y docente dentro de sus grupos. El histórico requiere contexto explícito. ALUMNO y FINANZAS no tienen acceso. No hay nota publicada al alumno ni push de conducta, conforme a la respuesta del usuario.

## Analítica académica y financiera

Consulta por ciclo/plantel/clase con roles y alcance en backend: inscritos, capturados/faltantes P1-P3, promedios por parcial, promedio oficial completo, aprobación orientativa con referencia de 60 y entregas vencidas/recibidas/faltantes. El promedio usa la misma función backend que reportes; `parcial=0` no se incorpora a P1-P3. Finanzas ve facturación, pagos aplicados y saldo; docente no recibe métricas financieras y Finanzas sin rol académico no recibe clases. La respuesta agregada no expone nombres de alumnos ni notas internas.

Son indicadores operativos calculados con datos del sistema. No se implementa predicción ni se certifica capacidad para un volumen institucional sin una prueba de carga real. La referencia de aprobación y las políticas académicas requieren aceptación de control escolar.

## Esquema y despliegue

Se crea una migración real incremental espejo:

- `database/mysql/migracion_operacion_ampliada.sql`
- `database/sqlserver/migracion_operacion_ampliada.sql`

Añade `ciclos_escolares.estado`, `conceptos_pago.aplica_recargo`, `bitacora_academica`, `incidencias`, `incidencia_seguimientos`, `push_dispositivos`, `push_envios` y `archivos_limpieza`, con entidades, claves e índices y paridad documental de `schema.sql`. El manifiesto la agrega después de sesiones rotativas; baseline v1 intacto. Los ciclos existentes activos pasan a ACTIVO, inactivos con grupos a CERRADO y los restantes a PREPARACION. Ese backfill conserva contexto histórico y no certifica que sus notas hayan pasado el nuevo cierre.

Mantener `DB_SYNC=false`; usar el runner documentado en [MIGRACIONES.md](MIGRACIONES.md), nunca aplicar `schema.sql` sobre una base existente. Coordinar API, web y móvil, mantener push deshabilitado hasta configurar y certificar. Los previews de importación viven en memoria: un reinicio los invalida y deben repetirse; no se persisten archivos con datos personales. El worker de limpieza requiere ACL de escritura sobre uploads.

Rollback: detener nuevas escrituras y workers, conservar backup verificado de DB/uploads, volver al artefacto previo compatible y dejar las tablas/columnas aditivas sin eliminarlas. Antes de volver a una versión anterior, revisar que solo hubiera un ciclo activo y los datos creados por la ampliación; los estados de ciclo/incidencias no deben gestionarse con clientes anteriores. No se ofrecen scripts destructivos ni se afirma que un backup no restaurado sea suficiente.

## Seguridad de dependencias móviles

Se retiran las excepciones de npm audit. Los paquetes transitivos `braces` y `node-forge` de Expo/Metro usan tarballs locales con parches revisables, licencias y manifiesto SHA-512 del origen y artefacto. Las regresiones prueban límite de anidación y validación estricta ASN.1 en firmas RSA, también desde sus consumidores reales. No se presentan como versiones oficiales. Deben sustituirse por correcciones oficiales cuando estén disponibles; véase [EXCEPCIONES_NPM_AUDIT.md](EXCEPCIONES_NPM_AUDIT.md) y [mobile/vendor/README.md](../mobile/vendor/README.md).

## Verificación

- Backend: instalación `npm ci`, audit sin vulnerabilidades, lint sin errores ni `any` de producción, typecheck de producción/integración, build y **154 pruebas en 31 suites**. Los avisos de mocks permanecen separados.
- Web: `npm ci`, audit sin vulnerabilidades, lint, **12 pruebas en cinco archivos** y build.
- Móvil: `npm ci`, gate de audit con **cero vulnerabilidades y cero excepciones**, regresiones de paquetes parcheados, **ocho pruebas** y **cinco pruebas del gate**, TypeScript y export Android.
- ETL: **tres pruebas** de unittest.
- Bases: **39 pruebas HTTP por motor**, baseline/adopción, migraciones, concurrencia y paridad física en bases nuevas aisladas MySQL 8.4 y SQL Server 2022, siempre `DB_SYNC=false`. Se incluyen aislamiento de rol/campus/grupo/ciclo, promoción, rollback de importación, reactivación, personal, conducta interna, analítica, recargos y limpieza de archivos con DTO inválido. Push usa proveedor simulado.
- Windows: sintaxis PowerShell validada en Linux; pruebas de junction/retención y comportamiento Windows se ejecutan en el job `windows-scripts` de la CI del SHA publicado. No equivalen a certificar un Windows Server de staging.
- No hay `.pyc` trackeados; permanece su exclusión. No se relajaron strict, lint, pruebas, sincronización de DB ni validaciones de seguridad.

## Pendiente que necesita entorno o información externa

Configuración/acceso de servidor, DNS/HTTPS/IIS/servicio, base TLS/ACL, restore real de DB/uploads cifrado fuera del VPS, monitoreo y responsable; SMTP con buzón real; Openpay sandbox completo o deshabilitado; EAS firmado y pruebas físicas de login/red/pagos/archivos/push; Chrome/Edge y aceptación de accesibilidad/privacidad/boletas. El ETL certweb completo necesita esquema real sanitizado y decisión de migrar histórico; no se inventan mapeos.

No se declara PILOTO LISTO ni Fase 5 cerrada. El estado por área está en [ESTADO_IMPLEMENTACION.md](ESTADO_IMPLEMENTACION.md) y la guía para usar el servidor existente en [PUBLICAR_SERVIDOR_EXISTENTE.md](PUBLICAR_SERVIDOR_EXISTENTE.md).

## Archivos modificados o creados en esta ampliación

- `README.md`
- `backend/.env.example`
- `backend/.env.staging.example`
- `backend/src/academico/academico.controller.ts`
- `backend/src/academico/academico.dto.ts`
- `backend/src/academico/academico.module.ts`
- `backend/src/academico/academico.service.spec.ts`
- `backend/src/academico/academico.service.ts`
- `backend/src/academico/ciclos.service.spec.ts`
- `backend/src/academico/ciclos.service.ts`
- `backend/src/academico/promocion.dto.ts`
- `backend/src/academico/promocion.service.ts`
- `backend/src/actividades/actividades.controller.ts`
- `backend/src/actividades/actividades.dto.ts`
- `backend/src/actividades/actividades.service.ts`
- `backend/src/alumnos/alumnos.controller.ts`
- `backend/src/alumnos/alumnos.dto.ts`
- `backend/src/alumnos/alumnos.service.ts`
- `backend/src/analitica/analitica.controller.ts`
- `backend/src/analitica/analitica.dto.ts`
- `backend/src/analitica/analitica.module.ts`
- `backend/src/analitica/analitica.service.ts`
- `backend/src/app.module.ts`
- `backend/src/archivos/archivo-limpieza.service.spec.ts`
- `backend/src/archivos/archivo-limpieza.service.ts`
- `backend/src/archivos/archivos.module.ts`
- `backend/src/auth/auth.module.ts`
- `backend/src/auth/sesiones-limpieza.service.ts`
- `backend/src/calificaciones/calificaciones.service.ts`
- `backend/src/common/contexto-academico.ts`
- `backend/src/common/limpieza-upload.interceptor.ts`
- `backend/src/common/upload.config.ts`
- `backend/src/conducta/conducta.controller.ts`
- `backend/src/conducta/conducta.dto.ts`
- `backend/src/conducta/conducta.module.ts`
- `backend/src/conducta/conducta.service.spec.ts`
- `backend/src/conducta/conducta.service.ts`
- `backend/src/docentes/docentes.controller.ts`
- `backend/src/docentes/docentes.dto.ts`
- `backend/src/docentes/docentes.service.ts`
- `backend/src/entities/archivo-limpieza.entity.ts`
- `backend/src/entities/bitacora-academica.entity.ts`
- `backend/src/entities/ciclo-escolar.entity.ts`
- `backend/src/entities/concepto-pago.entity.ts`
- `backend/src/entities/incidencia-seguimiento.entity.ts`
- `backend/src/entities/incidencia.entity.ts`
- `backend/src/entities/index.ts`
- `backend/src/entities/push-dispositivo.entity.ts`
- `backend/src/entities/push-envio.entity.ts`
- `backend/src/finanzas/cargos.service.spec.ts`
- `backend/src/finanzas/cargos.service.ts`
- `backend/src/finanzas/conceptos.service.ts`
- `backend/src/finanzas/finanzas.controller.ts`
- `backend/src/finanzas/finanzas.dto.ts`
- `backend/src/finanzas/pagos.service.ts`
- `backend/src/importaciones/importaciones.controller.ts`
- `backend/src/importaciones/importaciones.dto.ts`
- `backend/src/importaciones/importaciones.module.ts`
- `backend/src/importaciones/importaciones.service.ts`
- `backend/src/importaciones/lectura.spec.ts`
- `backend/src/importaciones/lectura.ts`
- `backend/src/notificaciones/notificaciones.module.ts`
- `backend/src/notificaciones/notificaciones.service.spec.ts`
- `backend/src/notificaciones/notificaciones.service.ts`
- `backend/src/notificaciones/push.controller.ts`
- `backend/src/notificaciones/push.dto.ts`
- `backend/src/notificaciones/push.service.spec.ts`
- `backend/src/notificaciones/push.service.ts`
- `backend/src/usuarios/usuarios.controller.ts`
- `backend/src/usuarios/usuarios.dto.ts`
- `backend/src/usuarios/usuarios.service.ts`
- `backend/test/critical-flows.integration-spec.ts`
- `database/baseline-manifest.json`
- `database/mysql/migracion_operacion_ampliada.sql`
- `database/mysql/schema.sql`
- `database/sqlserver/migracion_operacion_ampliada.sql`
- `database/sqlserver/schema.sql`
- `docs/AMPLIACION_1.15.0.md`
- `docs/ARQUITECTURA.md`
- `docs/CORRECCIONES_1.15.0.md`
- `docs/ESTADO_IMPLEMENTACION.md`
- `docs/EXCEPCIONES_NPM_AUDIT.md`
- `docs/REGLAS_PILOTO.md`
- `mobile/.env.example`
- `mobile/App.tsx`
- `mobile/app.json`
- `mobile/package-lock.json`
- `mobile/package.json`
- `mobile/src/push.test.ts`
- `mobile/src/push.ts`
- `mobile/src/screens/Perfil.tsx`
- `mobile/src/screens/Tareas.tsx`
- `mobile/vendor/README.md`
- `mobile/vendor/braces-3.0.4-escolar.0.tgz`
- `mobile/vendor/braces.patch`
- `mobile/vendor/node-forge-1.4.1-escolar.0.tgz`
- `mobile/vendor/node-forge.patch`
- `mobile/vendor/upstream.json`
- `scripts/check-mobile-audit.cjs`
- `scripts/check-mobile-audit.test.cjs`
- `scripts/verificar-parches-mobile.cjs`
- `web/src/App.tsx`
- `web/src/components/BitacoraAcademica.tsx`
- `web/src/components/CatalogoConceptos.tsx`
- `web/src/layout/Shell.tsx`
- `web/src/pages/Alumnos.tsx`
- `web/src/pages/Analitica.tsx`
- `web/src/pages/Conducta.test.tsx`
- `web/src/pages/Conducta.tsx`
- `web/src/pages/Docentes.tsx`
- `web/src/pages/Finanzas.tsx`
- `web/src/pages/Grupos.tsx`
- `web/src/pages/Maestro.tsx`
- `web/src/pages/Materias.test.tsx`
- `web/src/pages/Materias.tsx`
- `web/src/pages/Operaciones.tsx`
- `web/src/pages/Usuarios.tsx`
