# Auditoría del estado de Sistema Escolar 1.23.5

Fecha: 13 de octubre de 2026. Fuente funcional: `f8769c1dd5c5ad930691d249b57fd2c33f54cb0f`, después de integrar los PR [25](https://github.com/Marcor360/Sistema-Escolar/pull/25) y [26](https://github.com/Marcor360/Sistema-Escolar/pull/26). Este informe y el README son una actualización documental posterior; no cambian el comportamiento ni la versión del producto.

## Conclusión y criterio de madurez

| Componente | Versión / estado | Clasificación respaldada por evidencia |
|---|---|---|
| API y portal web | 1.23.5 | MVP funcional; alpha avanzada, en estabilización antes del piloto |
| App del alumno | 1.23.5 | MVP en alpha; bloqueo de arranque y validación nativa pendientes |
| Base de datos | Baseline v1 + siete migraciones incrementales espejo | Esquema probado en bases aisladas MySQL y SQL Server; instalación real desconocida |
| ETL de legado | Sin versión independiente; implementación parcial | Prototipo, no listo para migración institucional general |
| Operación y seguridad | Controles implementados y pruebas automatizadas satisfactorias | Sin certificación de producción ni auditoría externa de penetración |

El sistema supera un prototipo visual: existen reglas de negocio, persistencia, autorización, transacciones y pruebas con ambos motores. No hay evidencia suficiente de aceptación institucional, operación sostenida o usuarios externos controlados para clasificarlo como beta o primera versión estable de producción. La numeración 1.23.5 describe el código; no certifica esas etapas.

## Alcance y trazabilidad del barrido

El [inventario CSV](auditoria/INVENTARIO_1.23.5_2026-10-13.csv) registra los **495 archivos versionados** del SHA fuente, con tamaño, líneas, SHA-256, área y controles aplicados. Son 491 archivos de texto y cuatro binarios: una fuente tipográfica y tres paquetes de dependencias corregidas. No incluye los nuevos documentos de esta auditoría ni archivos locales, secretos, dependencias instaladas o artefactos de compilación.

| Área | Archivos |
|---|---:|
| Raíz | 5 |
| GitHub / CI | 2 |
| Backend | 237 |
| Database | 45 |
| Documentación | 39 |
| ETL | 11 |
| Mobile | 44 |
| Scripts | 18 |
| Web | 94 |

Se leyeron los textos y se verificaron inventario, sintaxis, referencias y patrones de riesgo. El análisis estructural recorrió 344 archivos JavaScript/TypeScript, incluidos 90 archivos de pruebas, sin errores de parseo; inventarió imports, métodos y llamadas. Identificó 20 controladores y 151 rutas API. El comprobador de contratos relacionó 159 llamadas reconocibles de los clientes con esas rutas; esto no demuestra todas las llamadas dinámicas posibles. Se validaron JSON, sintaxis Python, enlaces locales Markdown y correspondencia de migraciones entre motores. La revisión funcional se concentró en reglas, límites de autorización, persistencia, concurrencia y fallos por módulo.

Este barrido combina cobertura automatizada de todos los archivos con revisión funcional de los puntos de control. No equivale a ejecución de cada rama, revisión humana exhaustiva de cada línea ni prueba contra producción. No se leyó el `.env` local ni se modificó ninguna base de datos institucional.

## Versiones verificadas

Versiones declaradas de backend, web y móvil, sus lockfiles y configuración Expo: **1.23.5**, coherentes. Versiones resueltas en los lockfiles:

| Área | Dependencias principales |
|---|---|
| Backend | NestJS 11.2.7; TypeORM 0.3.31; TypeScript 5.9.3 |
| Web | React 18.3.1; Vite 6.4.3; TypeScript 5.9.3 |
| Móvil | Expo 57.0.27; React Native 0.86.3; React 19.2.3; TypeScript 6.0.3 |
| Ejecución | Node 24 en CI; Python 3.11 en CI |
| Motores de integración | MySQL 8.4; SQL Server 2022 |

EAS dispone de perfiles de desarrollo, preview y producción; la existencia del perfil no demuestra que haya un APK/IPA firmado, distribuido o aceptado en tiendas. Los números nativos de compilación gestionados fuera del repositorio no fueron certificados.

## Base de datos

Ambos esquemas documentan las mismas 39 tablas. Hay 38 clases de entidad, distribuidas en 37 archivos, y una tabla de asociación de roles. El registro `schema_migrations` lo gestiona el ejecutor y es adicional al esquema documentado.

Los dos motores comparten baseline `v1`, 12 migraciones incorporadas al baseline y siete incrementales ordenadas:

1. `migracion_grupos_plantel_unique.sql`
2. `migracion_pagos_manual_idempotencia.sql`
3. `migracion_cierre_historial_calificaciones.sql`
4. `migracion_sesiones_rotativas.sql`
5. `migracion_operacion_ampliada.sql`
6. `migracion_integridad_operativa.sql`
7. `migracion_previews_importacion.sql`

“Pendientes” en el manifiesto significa posteriores al baseline, no necesariamente pendientes en un servidor existente. No se conoce el registro ni la versión del motor instalado en producción. PR 25 y 26 no modifican el esquema.

El ejecutor exige `DB_SYNC=false`, bloquea ejecución concurrente y rechaza adoptar silenciosamente una instalación sin historial. `adopt` requiere comparar previamente el esquema real. MySQL puede aplicar DDL parcialmente: rollback de código no revierte automáticamente migraciones. No ejecutar `schema.sql` completo sobre bases existentes. Véase [MIGRACIONES](MIGRACIONES.md).

## Revisión por componente

| Componente | Controles y comportamiento revisados | Límite o comprobación pendiente |
|---|---|---|
| Identidad y sesiones | JWT corto, refresh rotativo con hash, revocación por sesión/versión, detección de reutilización, recuperación de un solo uso y cambio inicial obligatorio | Validación del entorno y recuperación real por SMTP |
| Roles y planteles | Roles actuales y expediente activo comprobados; ScopeService y política central; portal móvil del alumno | Aceptación de la matriz institucional de acceso |
| Alumnos y docentes | DTO sin hash; búsquedas, detalle y mutaciones; respuestas tardías ignoradas; filtros aplicados conservados | UX con usuarios reales y datos de volumen institucional |
| Ciclos, grupos, inscripción y promoción | Etapas preparación/activo/cierre; integridad del plantel; promoción transaccional | Ensayo de cierre y promoción con una copia representativa |
| Actividades y calificaciones | Clase e inscripción vigentes, bloqueo concurrente, promedio oficial P1–P3, Final separado; correcciones justificadas e historial | Casos institucionales de evaluación y aceptación docente |
| Calendario | Alta/listado/baja; permisos de creador y plantel coherentes en API y web, incluso roles combinados | No hay edición PATCH implementada |
| Conducta | Acceso interno limitado; sin acceso de alumno/finanzas ni contenido sensible en push | Política institucional de conservación |
| Analítica y reportes | Alcance por rol/plantel, agregados históricos, PDF/Excel y promedio común | Revisión de reportes con responsables y datos reales |
| Finanzas y Openpay | Idempotencia y bloqueos; verificación externa de transacción, monto, moneda y referencia; origen del plantel preservado tras traslado | Certificación con proveedor, conciliación y recuperación ante fallos reales |
| Correo | Cola persistente y tratamiento explícito de resultado incierto | Entrega, DNS y credenciales reales no certificados |
| Importaciones | Preview cifrado AES-GCM, vinculado al actor, TTL de 15 minutos, límites y confirmación atómica con revalidación | Validación institucional de datos; rotar clave invalida previews pendientes |
| Archivos y marca | Descarga firmada vinculada a sesión y recurso, comprobación de alcance, sin carpeta pública de uploads; extensión, firma y tamaño | No hay antivirus ni cuota total por usuario/plantel |
| Push | Cola persistente, tickets/receipts/reintentos, opt-in y mensajes genéricos | FCM/APNs, permisos y entrega en dispositivos físicos |
| Web | Cookie refresh HttpOnly/SameSite Strict, acceso en memoria, control de origen y rotación coordinada; modal/foco y listados responsivos | Auditoría integral de accesibilidad; algunas tablas mantienen desplazamiento horizontal |
| App | SecureStore, manejo de red transitoria, pantalla inicial tolerante a fallos parciales, materias y tareas ligadas al usuario, reautenticación al cambiar contraseña | Fallo de arranque descrito debajo; QA nativa y publicación |
| ETL | Consultas parametrizadas, dry-run, rollback y cierre de conexiones; extracción original de lectura | Sólo planteles/alumnos implementados, mapeo legado provisional y TLS pendiente |
| CI y despliegue | Validación de ambos motores; scripts PowerShell comprobados en Windows; staging manual condicionado a SHA validado; snapshots y rollback de código | Restauración y despliegue real en VPS/IIS no ejecutados en esta auditoría |

## Evidencia de validación

| Comprobación | Resultado |
|---|---|
| Backend unitario | 191 pruebas, 39 suites, satisfactorias |
| Backend tipos y lint | Tipos correctos; lint: cero errores y 527 advertencias |
| Web | 75 pruebas, 23 archivos; lint y build satisfactorios |
| Responsive Chromium | Comprobaciones entre 320 y 3840 px satisfactorias |
| Móvil | 27 pruebas en ocho archivos + cinco pruebas de política de auditoría; tipos y exportación Android Expo satisfactorios |
| ETL | Siete pruebas y compilación Python satisfactorias |
| Integración MySQL | 73 pruebas satisfactorias |
| Integración SQL Server | 73 pruebas satisfactorias |
| Job web-e2e | 76 pruebas de integración/navegador (73 + tres) satisfactorias |
| Contratos e inventario | Versiones, rutas reconocidas, manifiestos espejo y enlaces locales coherentes |
| Dependencias npm | Cero vulnerabilidades conocidas informadas en backend, web y móvil |
| Dependencias Python | Cero vulnerabilidades conocidas en la resolución auditada de requirements |

Los resultados de integración están en la [CI del código combinado de PR 26](https://github.com/Marcor360/Sistema-Escolar/actions/runs/38442392681); los ocho jobs aprobaron. [CI de PR 25](https://github.com/Marcor360/Sistema-Escolar/actions/runs/38442276998). Las pruebas unitarias adicionales del barrido se ejecutaron sobre el SHA fuente. Los conteos pertenecen a suites distintas y no deben sumarse como cobertura de escenarios únicos.

La resolución Python auditada fue pyodbc 5.3.0, pymssql 2.4.4, mysql-connector-python 9.7.0, python-dotenv 1.2.4 y bcrypt 4.3.0. `requirements.txt` contiene rangos y no un lockfile: no se certifican esas versiones en el servidor. Los paquetes locales sprintf-js, braces y node-forge incluyen parches revisados y verificadores; requieren mantenimiento y futura sustitución por versiones oficiales corregidas. Cero avisos de dependencias no significa ausencia de fallos de diseño o vulnerabilidades desconocidas.

## Hallazgos pendientes

### P1 — Arranque móvil puede quedar bloqueado

En `mobile/App.tsx`, efecto de marca, la lectura inicial `SecureStore.getItemAsync(MARCA_CACHE_KEY)` y la eliminación de caché inválida ocurren fuera de la protección que garantiza finalizar la carga. Si SecureStore rechaza, `marcaLista` permanece en falso y la pantalla de arranque no termina.

Se reprodujo ejecutando el callback extraído del código real, transpilado y con SecureStore simulado que rechaza: API no consultada, rechazo sin capturar y `marcaLista=false`. Es evidencia de lógica, no una prueba física del dispositivo. Las pruebas actuales no cubren este fallo de App completo. **Corregir antes del piloto móvil:** proteger lectura/eliminación, garantizar finalización y marca predeterminada, añadir regresión y validar almacenamiento fallido en dispositivo. No se modificó este comportamiento en la actualización documental.

### P1 — ETL no apto todavía para migración institucional

`etl/etl/extract.py` y `etl/etl/load.py` no configuran explícitamente TLS y validación de certificado de las conexiones. La protección depende de valores por defecto del driver/servidor y no está garantizada por el código. Usuarios, docentes y grupos siguen sin pipeline implementado y los nombres del legado requieren confirmar el esquema real.

Antes de migrar: conexión cifrada verificada, credencial de lectura del origen, lock de dependencias, mapeo completo, ensayo en copia aislada, conciliación y rollback probado. Esto limita el ETL; no invalida los flujos académicos del MVP que operan sobre la base propia.

### P2 — Endurecimiento y mantenibilidad

- Añadir huella de contenido a migraciones aplicadas; hoy el historial identifica archivos, no detecta modificación posterior de su SQL.
- Definir cuotas de almacenamiento, retención y antivirus según el uso institucional; la firma de archivo no detecta malware.
- Reducir 527 advertencias de lint, principalmente tipado `any`; actualmente no bloquean compilación.
- Evaluar pinning por SHA de acciones y digests de imágenes CI para mejorar trazabilidad de cadena de suministro.
- Completar aceptación de accesibilidad, manejo de datos de menores y política de conservación con la institución.

No se observó ejecución arbitraria pública de código en los puntos analizados. El SQL dinámico del ejecutor usa nombres de manifiesto controlados; las llamadas de procesos corresponden a herramientas internas. Esta observación no sustituye un pentest.

## Condiciones para avanzar a beta / primera versión operativa

1. Resolver el P1 de arranque móvil; para migración de legado, resolver además el P1 del ETL.
2. Desplegar el SHA aprobado en staging con TLS, secretos propios y esquema conciliado; probar copia de seguridad y restauración aislada.
3. Ensayar permisos, altas/traslados, tareas/calificaciones, cierre/promoción, cobros y archivos con responsables institucionales.
4. Generar builds nativos firmados; probar Android/iOS físicos, permisos, push, documentos, reconexión y cambio de cuenta.
5. Validar SMTP/Openpay, monitoreo, alertas, recuperación y aceptación operativa. Registrar resultados y responsables.

Con usuarios de piloto controlado y aceptación documentada puede evaluarse beta. Una primera versión estable requiere además operación y recuperación verificadas. Véanse [reglas del piloto](REGLAS_PILOTO.md), [operación](OPERACION_PRODUCCION.md) y [staging Windows/IIS](STAGING_WINDOWS_IIS.md).
