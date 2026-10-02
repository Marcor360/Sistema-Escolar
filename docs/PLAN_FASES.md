# Plan de trabajo por fases

Plan basado en los hallazgos de [AUDITORIA.md](./AUDITORIA.md). La idea es atender un bloque pequeño cada vez y cerrar sus criterios antes de empezar el siguiente. Este documento describe el trabajo esperado; no aplica cambios al código.

## Qué se espera al trabajar un bloque

Cada bloque debe terminar con:

1. Alcance limitado a los archivos y comportamiento indicados.
2. Cambio revisable con pruebas enfocadas al caso correcto y al caso que debe rechazarse.
3. Verificaciones de los workspaces afectados, con resultados reales.
4. Actualización del estado del bloque: cerrado, pendiente o impedido, con motivo.
5. Sin cambios de esquema improvisados: si se requiere esquema, entidad TypeORM y migración incremental equivalente en MySQL y SQL Server; `schema.sql` es solo espejo documental.

No se debe considerar una tarea terminada solo porque el código compile. Deben pasar sus criterios de aceptación.

## Orden recomendado

1. **Fase A:** riesgos de pagos, producción, dependencias y credenciales.
2. **Fase B:** consistencia de datos, paginación y verificación de los dos motores.
3. **Fase C:** cobertura, accesibilidad, estados de UI y deuda de tipado/documentación.

La Fase B comienza cuando los bloques A-DEP, A-PAGOS, A-OPENPAY, A-RECUPERACION y A-SEED estén cerrados o tengan una excepción de riesgo aprobada y documentada. La Fase C puede prepararse en paralelo, pero sus cambios se priorizan después de los controles críticos.

---

## Fase A — Críticos y seguridad

### A-DEP. Actualizar dependencias vulnerables

**Hallazgos:** AUD-01, AUD-02, AUD-03, AUD-06.

**Trabajo:** actualizar los paquetes directos/transitivos reportados por `npm audit` en backend y web; actualizar Expo por una ruta compatible con el SDK y React Native actuales. No aplicar `npm audit fix --force` a ciegas. Agregar una política de audit a CI.

**Resultado esperado:** cada `package-lock.json` queda reproducible y las dependencias vulnerables altas de producción se eliminan o quedan anotadas como excepción temporal con paquete, motivo y fecha de reevaluación.

**Validación:** `npm ci`, lint, typecheck/build y pruebas del workspace; repetir `npm audit` y `npm audit --omit=dev`. Para Expo, generar bundle/build compatible y revisar login, SecureStore, navegación y carga/descarga de archivos.

**Criterio de cierre:** no queda una vulnerabilidad alta de producción sin excepción documentada; CI hace visible el resultado y las excepciones tienen responsable y fecha.

### A-PAGOS. Impedir pagos por encima del saldo

**Hallazgo:** AUD-04.

**Trabajo:** definir qué significa un pago sin `cargoId`; al pagar un cargo, bloquearlo dentro de la transacción, recalcular el total confirmado y el saldo bajo ese bloqueo, validar el monto y recalcular el estado. Evitar que un pago manual y un webhook consuman simultáneamente el mismo saldo.

**Resultado esperado:** el saldo del cargo nunca se vuelve negativo por pagos confirmados y un intento de pago excedente tiene una respuesta controlada, sin persistir un pago parcial.

**Pruebas mínimas:** pago menor al saldo, pago exacto, pago mayor, dos pagos manuales simultáneos, webhook simultáneo con pago manual, repetición del webhook e intento sin cargo.

**Criterio de cierre:** todos los escenarios mantienen consistencia entre pagos, saldo, estado del cargo y bitácora en ambos motores.

### A-OPENPAY. Configuración segura en producción

**Hallazgo:** AUD-05.

**Trabajo:** separar sandbox y producción explícitamente; validar durante el arranque las credenciales, URL de API y URL de retorno para el ambiente elegido. En producción, rechazar sandbox, localhost, esquemas no HTTPS y configuración incompleta.

**Resultado esperado:** una configuración productiva incompleta falla antes de aceptar pagos, en lugar de enviar al sandbox o redirigir a localhost.

**Pruebas mínimas:** producción sin URL, producción con sandbox, URL de retorno local, URL productiva válida y configuración de desarrollo sandbox.

**Criterio de cierre:** cada combinación se acepta o rechaza de forma predecible; ninguna ruta productiva usa defaults de desarrollo.

### A-RECUPERACION. Recuperación de contraseña operativa

**Hallazgo:** AUD-07.

**Trabajo:** exigir SMTP válido en producción y tratar errores de entrega sin filtrar si la cuenta existe. En desarrollo/pruebas, usar un transporte local o una bandeja de pruebas; nunca imprimir el token de recuperación en logs persistentes.

**Resultado esperado:** la persona puede recibir y usar el token en ambientes configurados, y los errores de correo quedan observables para operación.

**Pruebas mínimas:** cuenta existente, cuenta inexistente, expiración, token usado dos veces, error de SMTP, SMTP faltante en producción y recuperación en testing sin envío real.

**Criterio de cierre:** el token solo se almacena hasheado, expira y se consume una sola vez; la respuesta pública mantiene protección contra enumeración de cuentas.

### A-SEED. Quitar credenciales demo reutilizables

**Hallazgo:** AUD-08.

**Trabajo:** eliminar contraseñas literales conocidas del seed; exigir secretos configurados o generar credenciales temporales únicas para cada ejecución. Conservar el bloqueo de producción y el opt-in explícito.

**Resultado esperado:** correr el seed deliberadamente no crea cuentas con contraseñas públicas/reutilizables y nunca registra credenciales.

**Pruebas mínimas:** seed rechazado en producción aunque haya opt-in, rechazado sin `NODE_ENV` o sin opt-in, permitido solo en development/test con configuración válida.

**Criterio de cierre:** la ejecución produce cuentas demo solo con credenciales únicas y no deja secretos en salida de consola ni bitácoras.

---

## Fase B — Bugs y estabilidad

### B-CICLO. Activación consistente del ciclo escolar

**Hallazgo:** AUD-09.

**Trabajo:** mover la desactivación/activación a una transacción y controlar escrituras concurrentes. Definir una estrategia compatible con MySQL y SQL Server para evitar dos ciclos activos.

**Resultado esperado:** cualquier fallo revierte el cambio completo y el sistema conserva como máximo un ciclo activo.

**Pruebas mínimas:** crear ciclo activo, activar otro, fallo al guardar, dos activaciones concurrentes y lectura después de cada caso.

**Criterio de cierre:** ciclo activo y datos asociados quedan consistentes en ambos motores.

### B-GRUPO. Corregir unicidad de grupos por plantel

**Hallazgo:** AUD-10.

**Trabajo:** actualizar la clave única a `(cicloId, plantelId, nombre)` en entidad y migraciones incrementales. Antes de la migración, detectar si existen duplicados incompatibles y definir una resolución segura.

**Resultado esperado:** dos planteles distintos pueden crear `1-A` en el mismo ciclo, pero el mismo plantel no puede duplicarlo.

**Pruebas mínimas:** mismo nombre en dos planteles, mismo nombre duplicado en uno, ciclos diferentes y comportamiento de la migración con datos existentes.

**Criterio de cierre:** entidad, MySQL y SQL Server coinciden; no se usa `DROP`, `TRUNCATE`, recreación de base ni `DB_SYNC=true`.

### B-PAGINACION. Paginar el listado legado de usuarios

**Hallazgo:** AUD-11.

**Trabajo:** retirar `GET /usuarios` si no tiene consumidores o aplicar paginación/filtros con el mismo límite documentado que los demás listados.

**Resultado esperado:** ningún listado administrativo de usuarios carga la tabla completa en memoria.

**Validación:** revisar consumidores web/API, verificar paginación inicial y límites máximos, y comprobar que la proyección no incluya `passwordHash`.

**Criterio de cierre:** contrato documentado, consumidores migrados y prueba del límite de página.

### B-CI. Hacer confiable la integración SQL Server en CI

**Hallazgo:** AUD-15.

**Trabajo:** agregar health check o espera acotada/reintentos antes de conectar; imprimir diagnóstico útil si vence el tiempo; mantener DB de integración aislada.

**Resultado esperado:** el job empieza las pruebas solo cuando SQL Server acepta conexiones.

**Validación:** ejecutar varias veces el job o una reproducción equivalente; ejecutar también el job MySQL y confirmar que ambos parten con `DB_SYNC=false`.

**Criterio de cierre:** los dos jobs completan la integración sobre bases temporales sin depender de una base de desarrollo existente.

### B-BASELINE. Verificar baseline y migraciones desde base vacía

**Alcance:** verificación de arranque desde cero; el manifiesto y archivos baseline existen, pero el proceso no se ejecutó en esta auditoría.

**Trabajo:** en una base nueva y aislada por motor, aplicar el baseline y luego las migraciones incrementales en orden. Comparar entidades/esquema y probar los flujos críticos.

**Resultado esperado:** una instalación limpia llega al mismo esquema funcional en MySQL y SQL Server.

**Criterio de cierre:** pasos repetibles documentados, migraciones en paridad, pruebas DB verdes y sin ejecutar scripts destructivos contra bases existentes.

---

## Fase C — Refactor, UX/UI y deuda técnica

### C-PRUEBAS. Agregar pruebas de comportamiento web y móvil

**Hallazgo:** AUD-16.

**Trabajo:** escoger primero login/sesión, rutas por rol, pantallas de alumno, estados de error y flujo de pago; agregar pruebas a esos contratos. Agregar al pipeline un bundle/build Expo compatible con CI.

**Resultado esperado:** regresiones básicas del portal y de la app quedan detectadas automáticamente.

**Criterio de cierre:** las pruebas corren en CI, fallan ante una regresión demostrada y no dependen de API o cuentas productivas.

### C-ACCESIBILIDAD. Accesibilidad y responsive

**Hallazgos:** AUD-12, AUD-13 y el inventario de targets táctiles.

**Trabajo:** cambiar el color del texto de aviso por uno con contraste suficiente; hacer login fluido en viewports estrechos; revisar etiquetas, foco, formularios y áreas táctiles de 44 dp/px según plataforma.

**Resultado esperado:** los estados se distinguen sin depender solo del color y las pantallas clave se pueden usar en móvil y con lector de pantalla.

**Validación:** revisar ratios WCAG, teclado/foco web, lector de pantalla y dispositivos/viewport acordados; corregir findings concretos del escáner.

**Criterio de cierre:** contraste AA para texto normal, sin desbordamiento horizontal en login y acciones principales con objetivos accesibles.

### C-ESTADOS. Unificar estados de carga, error y vacío en móvil

**Hallazgo:** AUD-14.

**Trabajo:** representar carga inicial, carga de actualización, error reintentable y respuesta vacía como estados diferentes. No mostrar saldo cero o “sin datos” antes de recibir respuesta correcta.

**Resultado esperado:** una falla de red no se confunde con una cuenta vacía y cada error permite reintentar.

**Criterio de cierre:** revisar Inicio, Materias, Tareas, Calificaciones, Estado de cuenta y Perfil con éxito, respuesta vacía, error y reintento.

### C-OFFLINE. Decidir alcance offline

**Alcance:** el funcionamiento offline no se verificó como capacidad existente; la app hace peticiones directas al backend.

**Trabajo:** definir qué información puede cachearse, cuánto tiempo, cómo se indica su antigüedad y qué acciones requieren conexión. Tratar envío de tareas/pagos como operaciones no repetibles sin idempotencia definida.

**Resultado esperado:** una decisión explícita de producto (sin offline o capacidades limitadas) antes de escribir sincronización local.

**Criterio de cierre:** flujo desconectado y reconectado documentado y probado si se decide implementarlo; si no, la app muestra claramente que requiere conexión.

### C-DEUDA. Tipado, Swagger y rendimiento medido

**Alcance:** deuda identificada en payload Openpay, QueryBuilder, contratos Swagger y listados.

**Trabajo:** tipar payloads externos con validación en runtime, eliminar `any` donde aporte seguridad, documentar respuestas/errores Swagger y medir consultas/bundle antes de refactorizar componentes.

**Resultado esperado:** contratos externos verificables y mejoras basadas en mediciones, sin refactor amplio que mezcle riesgo funcional.

**Criterio de cierre:** pruebas de payload válido/inválido, documentación de rutas priorizadas y métricas antes/después para cambios de rendimiento.

---

## Estado inicial de este plan

- **A1:** `passwordHash` ya está oculto con `select: false` y los flujos necesarios lo seleccionan explícitamente; conservar pruebas de regresión.
- **A2 / sesiones / scope:** gran parte del fundamento existe (`ScopeService`, versiones de sesión y validaciones de grupo); los huecos del reporte se atienden por los hallazgos vigentes, no se repite trabajo ya resuelto.
- **Fase A por iniciar:** dependencias; luego pagos; configuración Openpay; recuperación; seed. Estos nombres son los bloques de esta hoja y no reemplazan la nomenclatura previa A1–A8 del análisis de seguridad.
- **Fase B y C:** pendientes de los criterios descritos arriba.

**Primer bloque sugerido:** dependencias backend (AUD-01). Al iniciarlo, se limita el cambio a un workspace y se revisa el lockfile antes de pasar a web y móvil.
