# Auditoría del proyecto Sistema Escolar

**Fecha de revisión:** 1 de octubre de 2026  
**Alcance:** lectura estática de backend NestJS, web React/Vite, móvil Expo, ETL Python, configuración, migraciones y CI; verificaciones ejecutadas en el checkout local.

## Resumen ejecutivo

El proyecto compila y sus verificaciones disponibles pasan: backend 21 suites/89 pruebas, web lint/build, móvil TypeScript y ETL 3 pruebas.  
`npm audit` reporta vulnerabilidades altas en los tres árboles JavaScript, incluidas dependencias de ejecución.  
El registro manual acepta pagos mayores al saldo y órdenes Openpay pendientes no reservan el saldo contra pagos manuales posteriores.  
Openpay cae a sandbox y redirige a localhost si faltan variables, incluso en producción.  
La recuperación de contraseña no entrega el código cuando SMTP no está configurado, aunque responde como si se hubieran enviado instrucciones.  
El seed bloquea producción y exige opt-in, pero conserva credenciales demo conocidas para varias cuentas.  
El ciclo activo se modifica con varias escrituras no transaccionales; la unicidad de grupo impide repetir el nombre entre planteles.  
La auditoría no ejecutó integraciones contra MySQL/SQL Server ni compilaciones nativas de Expo; su estado queda como no verificado.

## Resultados de verificación

| Workspace | Verificación | Resultado |
|---|---|---|
| Backend | `npm run lint` | Pasó |
| Backend | `npm run typecheck` | Pasó |
| Backend | `npm run build` | Pasó |
| Backend | `npm test -- --runInBand` | Pasó: 21 suites, 89 pruebas |
| Backend | `npm run test:integration` MySQL / SQL Server | No verificado: requiere servicios de BD y credenciales de prueba; no se ejecutó contra bases locales |
| Backend | `npm audit` | Falló con vulnerabilidades: 33 (12 altas, 17 moderadas, 4 bajas, 0 críticas) |
| Backend | `npm audit --omit=dev` | Falló con 19 vulnerabilidades de producción (7 altas, 11 moderadas, 1 baja) |
| Web | `npm run lint` | Pasó |
| Web | `npm run build` | Pasó; Vite generó bundle de entrada de 224.92 kB (75.95 kB gzip) |
| Web | `npm test` | No disponible: no hay script ni pruebas automatizadas web |
| Web | `npm audit` | Falló con vulnerabilidades: 9 (6 altas, 3 moderadas, 0 críticas) |
| Web | `npm audit --omit=dev` | Falló con 3 vulnerabilidades de producción (1 alta, 2 moderadas) |
| Móvil | `npx tsc --noEmit` | Pasó |
| Móvil | Build nativo / `npm test` | No verificado: no hay script de build ni suite de pruebas en `mobile/package.json`; CI ejecuta solo TypeScript |
| Móvil | `npm audit` | Falló con vulnerabilidades: 24 (12 altas, 12 moderadas, 0 críticas) |
| Móvil | `npm audit --omit=dev` | Mismo resultado: Expo y sus dependencias quedan en el árbol de producción de este workspace |
| ETL | `python -m unittest discover -s etl/tests -v` | Pasó: 3 pruebas |
| ETL | `npm audit` | No aplica: no existe `etl/package.json` |
| ETL | Auditoría de dependencias Python | No verificado: `pip-audit` no está instalado en el entorno |

`npm audit` consultó el registro disponible el día de la auditoría. Entre los paquetes de ejecución de backend que npm marca con severidad alta están `@nestjs/platform-express`, `axios`, `multer` y `nodemailer`; en web, `axios`; en móvil, `axios`, `expo` y componentes transitivos de Expo. Los recuentos incluyen vulnerabilidades transitivas; no se aplicó `npm audit fix` ni se cambiaron dependencias.

El workflow ejecuta backend lint/typecheck/build/tests, web lint/build, móvil TypeScript y pruebas ETL. No incluye `npm audit` ni pruebas web/móvil; el job SQL Server tampoco declara health check para esperar a que el servicio acepte conexiones. No se consultó el estado actual de una ejecución remota de GitHub Actions.

## Hallazgos

| ID | Severidad | Área | Archivo:línea | Problema | Impacto | Corrección propuesta | Esfuerzo |
|---|---|---|---|---|---|---|---|
| AUD-01 | Alta | Seguridad / dependencias backend | [backend/package.json:24](../backend/package.json#L24), [backend/package.json:28](../backend/package.json#L28), [backend/package.json:36](../backend/package.json#L36), [backend/package.json:38](../backend/package.json#L38) | `npm audit --omit=dev` informa 7 vulnerabilidades altas en el árbol de producción; entre los paquetes directos afectados están `@nestjs/platform-express`, `axios`, `multer` y `nodemailer`. | Aumenta la exposición a fallas conocidas en HTTP, carga de archivos, peticiones salientes y correo. | Actualizar dependencias dentro de versiones compatibles con NestJS y probar el flujo de archivos, correo y Openpay; registrar el audit en CI. | M |
| AUD-02 | Alta | Seguridad / dependencias web | [web/package.json:14](../web/package.json#L14), [web/package.json:17](../web/package.json#L17) | `npm audit --omit=dev` informa 1 vulnerabilidad alta y 2 moderadas; `axios` es dependencia directa y está afectada. | Un paquete de peticiones de la aplicación queda dentro de rangos con avisos publicados. | Actualizar Axios y fijar el lockfile; ejecutar lint/build y revisar uso de adaptadores y entrada no confiable. | S |
| AUD-03 | Alta | Seguridad / dependencias móvil | [mobile/package.json:15](../mobile/package.json#L15), [mobile/package.json:16](../mobile/package.json#L16) | `npm audit --omit=dev` informa 12 altas y 12 moderadas, incluyendo `axios`, `expo` y dependencias transitivas de Expo. | El cliente y el toolchain móvil conservan componentes con vulnerabilidades conocidas. | Actualizar Expo mediante su matriz de compatibilidad y luego dependencias compatibles; generar bundle de desarrollo y validar SecureStore, navegación y documentos. | L |
| AUD-04 | Alta | Finanzas / pagos manuales | [backend/src/finanzas/pagos.service.ts:60](../backend/src/finanzas/pagos.service.ts#L60), [backend/src/finanzas/pagos.service.ts:66](../backend/src/finanzas/pagos.service.ts#L66), [backend/src/finanzas/pagos.service.ts:72](../backend/src/finanzas/pagos.service.ts#L72), [backend/src/finanzas/cargos.service.ts:227](../backend/src/finanzas/cargos.service.ts#L227) | Al registrar un pago vinculado a un cargo no se compara el monto con su saldo pendiente ni se bloquea el cargo durante la suma. | Un pago puede sobrepasar el saldo; pagos manuales y webhooks concurrentes pueden aplicar ambos el mismo saldo. El estado se marca pagado, pero no se evita un saldo negativo ni se crea un flujo de sobrepago/reembolso. | Bloquear el cargo dentro de la transacción, recalcular el saldo confirmado bajo el bloqueo y rechazar el excedente; definir expresamente cómo registrar pagos no aplicados. | M |
| AUD-05 | Alta | Finanzas / Openpay producción | [backend/src/finanzas/openpay.service.ts:27](../backend/src/finanzas/openpay.service.ts#L27), [backend/src/finanzas/openpay.service.ts:30](../backend/src/finanzas/openpay.service.ts#L30), [backend/src/finanzas/openpay.service.ts:32](../backend/src/finanzas/openpay.service.ts#L32), [backend/src/finanzas/openpay.service.ts:65](../backend/src/finanzas/openpay.service.ts#L65) | Si no se configuran `OPENPAY_BASE_URL` y `OPENPAY_REDIRECT_URL`, el servicio usa sandbox y una URL `localhost`; no hay comprobación de configuración al iniciar en producción. | Una instalación puede arrancar con credenciales presentes pero enviar operaciones al entorno equivocado o devolver una redirección inaccesible. | Rechazar el arranque en producción si faltan URL de producción y redirección HTTPS permitida; separar configuración sandbox/producción de forma explícita. | S |
| AUD-06 | Media | Seguridad / CI | [.github/workflows/ci.yml:23](../.github/workflows/ci.yml#L23), [.github/workflows/ci.yml:41](../.github/workflows/ci.yml#L41), [.github/workflows/ci.yml:57](../.github/workflows/ci.yml#L57) | Ningún job ejecuta `npm audit`; la CI actual puede pasar aunque los lockfiles incluyan las vulnerabilidades encontradas en esta revisión. | La regresión de dependencias vulnerables no bloquea cambios ni queda visible en resultados normales de CI. | Añadir `npm audit` por cada workspace JS o un escaneo equivalente con política documentada de severidad y excepciones con caducidad. | S |
| AUD-07 | Media | Auth / recuperación de contraseña | [backend/src/auth/auth.service.ts:98](../backend/src/auth/auth.service.ts#L98), [backend/src/auth/auth.service.ts:106](../backend/src/auth/auth.service.ts#L106), [backend/src/notificaciones/notificaciones.service.ts:27](../backend/src/notificaciones/notificaciones.service.ts#L27), [backend/src/notificaciones/notificaciones.service.ts:89](../backend/src/notificaciones/notificaciones.service.ts#L89) | Sin `SMTP_HOST`, `enviarEmail()` solo registra destinatario y asunto y devuelve `simulado`; el token se guarda hasheado y no se imprime ni se devuelve. `forgotPassword()` aun así responde que envió instrucciones. | La recuperación de contraseña es imposible en instalaciones sin SMTP, incluidas configuraciones de producción que no validan ese requisito. | Hacer que producción requiera SMTP válido y reporte el fallo operativo; en desarrollo usar una bandeja local de correo o una vía de prueba solo para testing, sin publicar tokens en logs productivos. | S |
| AUD-08 | Media | Seguridad / seed | [backend/src/seed/seed.ts:35](../backend/src/seed/seed.ts#L35), [backend/src/seed/seed.ts:119](../backend/src/seed/seed.ts#L119), [backend/src/seed/seed.ts:127](../backend/src/seed/seed.ts#L127), [backend/src/seed/seed.ts:130](../backend/src/seed/seed.ts#L130) | El seed sí bloquea `production` y exige `ALLOW_DEV_SEED=true`, pero asigna contraseñas demo conocidas a coordinación, maestro y alumnos. | Si una base/demo llega a un entorno accesible o se reutiliza, las credenciales conocidas permiten iniciar sesión. | Generar secretos aleatorios por ejecución o exigir variables por cuenta; evitar reutilizar estos usuarios fuera de ambientes aislados. | S |
| AUD-09 | Media | Estabilidad / ciclos escolares | [backend/src/academico/academico.service.ts:45](../backend/src/academico/academico.service.ts#L45), [backend/src/academico/academico.service.ts:50](../backend/src/academico/academico.service.ts#L50) | Al activar un ciclo primero se desactivan los activos y después se guarda/actualiza el ciclo, sin una transacción. | Si la segunda escritura falla, queda el sistema sin ciclo activo; peticiones concurrentes también pueden intercalar activaciones. | Ejecutar ambas escrituras en una transacción y definir una garantía de unicidad/serialización para el ciclo activo que funcione en MySQL y SQL Server. | M |
| AUD-10 | Media | Académico / grupos | [backend/src/entities/grupo.entity.ts:5](../backend/src/entities/grupo.entity.ts#L5), [backend/src/entities/grupo.entity.ts:6](../backend/src/entities/grupo.entity.ts#L6), [backend/src/academico/academico.service.ts:94](../backend/src/academico/academico.service.ts#L94) | La unicidad usa `(cicloId, nombre)` y omite `plantelId`. | Dos planteles no pueden crear el mismo grupo (por ejemplo, `1-A`) en el mismo ciclo, aunque los registros pertenecen a planteles distintos. | Cambiar la clave a `(cicloId, plantelId, nombre)` con entidad TypeORM y migraciones incrementales equivalentes en MySQL y SQL Server. | M |
| AUD-11 | Media | Rendimiento / usuarios | [backend/src/usuarios/usuarios.controller.ts:18](../backend/src/usuarios/usuarios.controller.ts#L18), [backend/src/usuarios/usuarios.service.ts:31](../backend/src/usuarios/usuarios.service.ts#L31) | `GET /usuarios` carga y proyecta todos los usuarios sin `skip`, `take` ni filtro; está reservado a `SUPERADMIN`, pero el volumen crece con la institución. | Uso elevado de memoria/tiempo y respuestas grandes al crecer la base. | Retirar la ruta heredada o aplicar el DTO de paginación, filtros y límites igual que en `listado`. | S |
| AUD-12 | Media | Móvil / accesibilidad | [mobile/src/theme.ts:7](../mobile/src/theme.ts#L7), [mobile/src/screens/comunes.tsx:8](../mobile/src/screens/comunes.tsx#L8), [web/src/styles.css:207](../web/src/styles.css#L207) | El dorado `#C79A3C` se usa como color de texto en sellos/estados sobre fondos claros. Su contraste con blanco es aproximadamente 2.6:1, por debajo de 4.5:1 para texto pequeño. | Usuarios con baja visión pueden no distinguir estados de aviso. | Usar un color de texto más oscuro para el estado y conservar el dorado para bordes, iconos o fondos con contraste revisado. | S |
| AUD-13 | Baja | Web / responsive | [web/src/styles.css:239](../web/src/styles.css#L239), [web/src/styles.css:240](../web/src/styles.css#L240) | La caja de login conserva ancho fijo de 360 px y no tiene una regla responsive propia. | En viewports menores a 360 px puede desbordarse horizontalmente. | Usar `width: min(360px, calc(100vw - 32px))` o regla equivalente y revisar login en viewport móvil estrecho. | S |
| AUD-14 | Baja | Móvil / estados de pantalla | [mobile/src/screens/Inicio.tsx:17](../mobile/src/screens/Inicio.tsx#L17), [mobile/src/screens/Inicio.tsx:21](../mobile/src/screens/Inicio.tsx#L21), [mobile/src/screens/Inicio.tsx:29](../mobile/src/screens/Inicio.tsx#L29), [mobile/src/screens/Materias.tsx:63](../mobile/src/screens/Materias.tsx#L63), [mobile/src/screens/Materias.tsx:67](../mobile/src/screens/Materias.tsx#L67) | Inicio muestra métricas iniciales en cero y materias presenta su estado vacío mientras la carga está pendiente o falló; no hay una separación consistente entre carga, error y respuesta vacía. | Una falla o espera de red se puede interpretar como datos vacíos o saldo cero, aunque ya exista un aviso de error en algunas pantallas. | No renderizar estados vacíos hasta completar la primera respuesta; mantener error con opción de reintento y distinguir carga inicial de actualización. | S |
| AUD-15 | Media | CI / integración SQL Server | [.github/workflows/ci.yml:96](../.github/workflows/ci.yml#L96), [.github/workflows/ci.yml:98](../.github/workflows/ci.yml#L98), [.github/workflows/ci.yml:131](../.github/workflows/ci.yml#L131) | El servicio SQL Server no declara health check ni paso de espera antes de `npm run test:integration`; MySQL sí tiene health check en el mismo workflow. | La integración puede empezar antes de que SQL Server acepte conexiones y fallar de forma intermitente. | Añadir health check apropiado para SQL Server o espera con reintentos y tiempo máximo; incluir diagnóstico de logs si vence. | S |
| AUD-16 | Media | Calidad / cobertura web y móvil | [web/package.json:6](../web/package.json#L6), [mobile/package.json:6](../mobile/package.json#L6), [.github/workflows/ci.yml:29](../.github/workflows/ci.yml#L29), [.github/workflows/ci.yml:45](../.github/workflows/ci.yml#L45) | Web y móvil no declaran suites de pruebas; CI solo hace lint/build para web y TypeScript para móvil. | Cambios de flujo de login, permisos de UI, estados de error y navegación pueden pasar CI sin pruebas de comportamiento. | Añadir pruebas de componentes/servicios prioritarios y al menos un build/bundle Expo verificable en CI. | M |
| AUD-17 | Baja | Infra local / exposición de puertos | [docker-compose.yml:9](../docker-compose.yml#L9), [docker-compose.yml:13](../docker-compose.yml#L13), [docker-compose.yml:28](../docker-compose.yml#L28), [docker-compose.yml:29](../docker-compose.yml#L29) | Compose etiqueta los servicios como desarrollo local, pero publica MySQL/SQL Server en todas las interfaces del host con contraseñas de ejemplo conocidas. | En una máquina conectada a una red compartida, otro host podría alcanzar las bases de desarrollo. | Limitar los puertos a `127.0.0.1` y usar contraseñas locales configurables; no reutilizar estas credenciales fuera de desarrollo aislado. | S |

## Verificaciones positivas relevantes

- `passwordHash` usa `select: false` y login/cambio/restablecimiento lo seleccionan explícitamente en [usuario.entity.ts](../backend/src/entities/usuario.entity.ts#L11) y [auth.service.ts](../backend/src/auth/auth.service.ts#L28).
- `JwtStrategy` vuelve a comprobar cuenta activa, versión de sesión y vigencia de expediente en [jwt.strategy.ts](../backend/src/auth/jwt.strategy.ts#L27).
- Las rutas principales de alumnos, docentes, grupos, actividades y finanzas aplican `ScopeService` y validan relaciones de maestro; ver [scope.service.ts](../backend/src/planteles/scope.service.ts#L14), [alumnos.service.ts](../backend/src/alumnos/alumnos.service.ts#L67) y [academico.service.ts](../backend/src/academico/academico.service.ts#L275).
- El webhook exige autenticación configurada en producción y valida orden, moneda, tipo e importe; ver [openpay-webhook.guard.ts](../backend/src/finanzas/openpay-webhook.guard.ts#L10) y [ordenes.service.ts](../backend/src/finanzas/ordenes.service.ts#L184).
- El seed bloquea producción y exige opt-in; archivos de alumnos/docentes se sirven por enlaces firmados de corta vida; CORS en producción queda cerrado si no se declara una lista de orígenes.
- Los nombres de migración incremental `migracion_*.sql` tienen paridad entre `database/mysql/` y `database/sqlserver/` en el checkout revisado.

## Plan de refactorización priorizado

1. **Cerrar los riesgos de pago y producción:** evitar sobrepagos bajo concurrencia; hacer explícito el destino Openpay por ambiente y bloquear configuración productiva incompleta.
2. **Actualizar dependencias vulnerables:** empezar con dependencias de ejecución reportadas por npm audit; actualizar Expo por su ruta compatible; agregar audit a CI.
3. **Recuperación y cuentas de demostración:** hacer verificable el requisito SMTP en producción y eliminar credenciales demo reutilizables.
4. **Consistencia del modelo académico:** activar ciclo en transacción y corregir unicidad de grupo con migración espejo para ambos motores.
5. **Capacidad y observabilidad:** paginar rutas heredadas, agregar espera SQL Server en CI y pruebas web/móvil para flujos críticos.
6. **UX y accesibilidad:** corregir contraste, ancho móvil de login y el manejo de estados iniciales/error/vacío.

## Plan de acción por fases

Para el desglose paso a paso, resultados esperados y criterios de cierre de cada bloque, consulta [PLAN_FASES.md](./PLAN_FASES.md).

### Fase A — Críticos y seguridad

- Actualizar los árboles vulnerables reportados por `npm audit`, comenzando por dependencias de ejecución de backend y web; actualizar Expo con compatibilidad oficial.
- Corregir los pagos manuales para validar saldo bajo bloqueo transaccional y cubrir concurrencia frente a webhooks.
- Hacer obligatoria la configuración de producción de Openpay y evitar sandbox/localhost como fallback productivo.
- Asegurar entrega de recuperación: SMTP requerido en producción y entorno de pruebas de correo sin filtrar el token.
- Reemplazar las contraseñas demo estáticas y habilitar `npm audit` en CI.
- Criterio de cierre: no hay altas de producción sin decisión documentada; pagos excedentes no se registran; configuración faltante impide iniciar en producción; pruebas negativas/positivas por rol y pago pasan.

### Fase B — Bugs y estabilidad

- B1. Hacer transaccionales los cambios de ciclo activo y proteger la unicidad de ciclo activo.
- B2. Cambiar unicidad de grupo a ciclo + plantel + nombre, con entidad y migraciones incrementales en ambos motores.
- B3. Paginar o retirar `GET /usuarios` sin límite.
- B4. Añadir readiness para SQL Server y ejecutar las integraciones MySQL y SQL Server con bases aisladas de CI.
- B5. Ejecutar y documentar el baseline incremental en una base vacía de prueba por motor, sin reutilizar bases existentes.
- Criterio de cierre: pruebas de consistencia y alcance pasan en MySQL y SQL Server; se documenta el resultado por cada motor.

### Fase C — Refactor, UX/UI y deuda técnica

- C1. Añadir pruebas de comportamiento web y móvil; integrar build/bundle Expo al pipeline.
- C2. Corregir contraste de estados, responsive del login y tamaños de objetivos táctiles; validar con escáner de accesibilidad y revisión manual.
- C3. Separar estados iniciales de carga, error y vacío en las pantallas móviles; decidir y documentar soporte offline antes de implementarlo.
- C4. Ampliar contratos de Swagger, disminuir `any` en Openpay/QueryBuilder y medir bundle/performance antes de extraer componentes.
- Criterio de cierre: pruebas automatizadas cubren los flujos de UI críticos y se revisan los estados responsive/accesibles con los dispositivos acordados.

## Lo que no se revisó

- No se ejecutaron los jobs de integración DB localmente; requieren instancias MySQL y SQL Server aisladas. CI sí contiene ambos jobs, pero no se consultó su ejecución remota actual.
- No se desplegó en infraestructura productiva ni se validaron variables reales, certificados TLS, dominios, CORS externo, SMTP real o credenciales Openpay del cliente.
- No se probaron escenarios de pasarela real, liquidación bancaria, conciliación con el comercio ni reembolsos; solo se inspeccionaron código y pruebas unitarias.
- No se renderizaron pantallas en varios dispositivos ni se ejecutó auditoría automatizada de accesibilidad; el contraste indicado se calculó con el color de código y la revisión responsive fue estática.
- No se auditó el ambiente Python por falta de `pip-audit`; las tres pruebas ETL sí se ejecutaron.
- La salida de `npm audit` refleja el registro y lockfiles disponibles el 1 de octubre de 2026 y debe repetirse al preparar cada release.

**Siguiente paso:** ¿Con qué fase quieres comenzar: A (seguridad), B (estabilidad) o C (UX y deuda técnica)?
