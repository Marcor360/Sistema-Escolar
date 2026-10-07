> Auditoría proporcionada por el usuario, conservada como referencia de trabajo.
> Evalúa el SHA `e0e3cfefa1f709f5d7ec5cf0930f6f4f7ca88834` de la versión 1.14.0.
> La publicación 1.15.0 incorpora este documento y actualiza el versionado;
> sus recomendaciones siguen pendientes salvo evidencia posterior explícita.

# Nueva auditoría del Sistema Escolar

**Repositorio:** `Marcor360/Sistema-Escolar`
**Main revisado:** `e0e3cfefa1f709f5d7ec5cf0930f6f4f7ca88834`
**Fecha:** 7 de octubre de 2026

## Estado actual

La base técnica está considerablemente mejor que en el análisis anterior.

La versión 1.14.0 ya:

* compila;
* pasa TypeScript estricto;
* pasa backend/web/móvil;
* pasa integración MySQL;
* pasa integración SQL Server;
* pasa scripts Windows;
* mantiene `DB_SYNC=false`;
* tiene migraciones controladas;
* tiene tests de integración de los flujos principales.

El proyecto ya no tiene como principal riesgo “que no arranque”. El riesgo actual es **que ciertas reglas produzcan comportamientos incorrectos cuando una escuela real empiece a operarlo**.

## Nuevos hallazgos importantes

| Prioridad      | Hallazgo                                                                                               | Evidencia                                                                                                                                                  | Impacto                                                                                                                                            | Corrección                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Alta**       | Dashboard de MAESTRO realiza una petición que el maestro no puede ejecutar                             | `web/src/pages/Dashboard.tsx:34-36` consulta `/reportes/resumen`; `backend/src/reportes/reportes.controller.ts:17-20` solo permite ADMINISTRATIVO/FINANZAS | Un maestro puede iniciar sesión correctamente y encontrar un 403 en su panel principal                                                             | Hacer dashboard por rol. MAESTRO debe consumir métricas propias de clases/grupos o no pedir el resumen financiero          |
| **Alta**       | IIS/ARR no está integrado con `trust proxy` de Express                                                 | `backend/src/main.ts:17-31`; IIS reenvía a `127.0.0.1:3000`                                                                                                | `req.ip` y rate limiting pueden interpretar a todos como `127.0.0.1`. Cinco intentos de login de varias personas podrían compartir el mismo límite | Configurar proxy confiable exclusivamente para el proxy local y verificar `X-Forwarded-For`, throttling y auditoría        |
| **Alta**       | “Pago a cuenta” actualmente significa realmente “pago confirmado no aplicado”                          | `web/src/pages/Finanzas.tsx:284-286`; `backend/src/finanzas/pagos.service.ts:89-103`                                                                       | Finanzas puede registrar dinero creyendo que reduce el saldo total, pero sin `cargoId` no reduce ningún cargo                                      | Para piloto: exigir cargo. Después, si se necesita pago a cuenta, implementar saldo a favor + asignación/conciliación real |
| **Alta**       | Un alumno puede potencialmente tener varias inscripciones activas en diferentes grupos del mismo ciclo | `backend/src/academico/academico.service.ts:273-291`; la validación solo evita duplicar alumno+grupo                                                       | Un alumno podría terminar simultáneamente en 1-A y 1-B del mismo ciclo y mezclar materias/calificaciones                                           | Definir regla institucional. Si solo puede pertenecer a un grupo por ciclo, validarlo transaccionalmente                   |
| **Alta**       | El ciclo de un grupo puede modificarse después de creado                                               | `backend/src/academico/academico.dto.ts:49-53`; `academico.service.ts:148-158`                                                                             | Cambiar `cicloId` puede trasladar indirectamente inscripciones, materias y calificaciones históricas a otro ciclo                                  | Hacer `cicloId` inmutable después de crear el grupo o crear un proceso explícito y restringido                             |
| **Alta**       | Desactivar plantel no valida dependencias activas                                                      | `backend/src/planteles/planteles.dto.ts:12-17`; `planteles.service.ts:74-77`                                                                               | Puede quedar un plantel inactivo con alumnos/grupos/usuarios todavía operativos                                                                    | Implementar transición “cerrar/desactivar plantel” con validación de grupos, alumnos, personal y ciclos                    |
| **Media-Alta** | Desactivar materia no valida si todavía se imparte                                                     | `backend/src/academico/academico.service.ts:101-109`                                                                                                       | Una materia activa en grupos actuales puede desaparecer del catálogo mientras sigue teniendo clases                                                | Bloquear desactivación con asignaciones activas o cerrar primero esas asignaciones                                         |
| **Media-Alta** | Eliminar personal de un plantel no resuelve sus asignaciones académicas                                | `backend/src/planteles/planteles.service.ts:96-101`; acceso MAESTRO depende de `grupoMateria` en `calificaciones.service.ts:29-40`                         | Quitar un maestro del plantel puede no quitarle acceso mientras continúe asignado a clases                                                         | Rechazar la eliminación mientras existan clases activas o exigir reasignación previa                                       |
| **Media-Alta** | La app del alumno no muestra el estado real de los pagos                                               | Backend devuelve `estatus`; móvil lo elimina en `mobile/src/screens/EstadoCuenta.tsx:13-17` y muestra los pagos en `87-97`                                 | Un pago pendiente/fallido/cancelado puede parecer un pago normal                                                                                   | Incluir estatus y diferenciar `CONFIRMADO`, `PENDIENTE`, `FALLIDO`, `CANCELADO`                                            |
| **Media-Alta** | Validación de DTO académicos/alumnos/docentes sigue siendo demasiado permisiva                         | `academico.dto.ts:11-53`, `alumnos.dto.ts:10-39`, `docentes.dto.ts:9-29`, `usuarios.dto.ts:9-26`                                                           | Strings demasiado largos o fechas inválidas pueden terminar en errores SQL/500 en vez de 400 claros                                                | Añadir `MaxLength`, `Min`, `IsDateString`, patrones, normalización y validaciones relacionales                             |
| **Media**      | Archivos se aceptan principalmente por extensión                                                       | `backend/src/common/upload.config.ts:8-26`, `configuracion/logo-upload.config.ts:7-20`                                                                     | Renombrar un archivo no demuestra que su contenido sea realmente PDF/JPEG/etc.                                                                     | Verificar extensión + MIME + firma real/magic bytes. Mantener lista cerrada                                                |
| **Media**      | SMTP simulado escribe datos personales en logs                                                         | `backend/src/notificaciones/notificaciones.service.ts:95-99`                                                                                               | En staging puede quedar email del usuario y asunto en logs                                                                                         | No registrar destinatario ni contenido. Registrar solo evento técnico sin PII                                              |
| **Media**      | Calendario está limitado silenciosamente a 500 filas                                                   | `backend/src/calendario/calendario.service.ts:26-74`                                                                                                       | Al acumular años de eventos, los futuros pueden quedar fuera según la consulta                                                                     | Exigir rango temporal y/o paginar                                                                                          |
| **Media**      | Swagger existe pero la documentación por endpoint sigue incompleta                                     | `backend/src/main.ts:33-40`; los controladores tienen `ApiTags`/`ApiBearerAuth`, pero no contratos detallados por operación                                | Swagger sirve para descubrir rutas, pero no es aún un contrato API completo                                                                        | Agregar operaciones, respuestas, errores y ejemplos a endpoints críticos                                                   |
| **Media**      | No encontré pruebas de carga/rendimiento reales                                                        | No hay k6, Artillery, autocannon ni equivalente en el repo                                                                                                 | No sabemos todavía cómo responde con cientos de alumnos y captura masiva simultánea                                                                | Crear una prueba de carga enfocada en login, grupos, calificaciones, estado de cuenta y reportes                           |
| **Media**      | No existe correlación de requests en logs                                                              | No encontré `requestId`, `correlationId` o `traceId`                                                                                                       | Cuando un usuario reporte un error será difícil seguir una operación entre IIS, Nest y DB                                                          | Añadir ID de petición y propagarlo a logs/errores operativos                                                               |
| **Baja-Media** | Health únicamente comprueba DB                                                                         | `backend/src/health/health.controller.ts:10-17`                                                                                                            | Puede responder OK aunque existan problemas con almacenamiento/configuración operacional                                                           | Separar liveness/readiness y añadir versión/build y comprobaciones operativas seguras                                      |

## 1. El dashboard del profesor tiene un bug real

Esto no lo había marcado antes.

La aplicación permite entrar al `/` a MAESTRO.

Pero `Dashboard.tsx` ejecuta siempre:

```text
GET /reportes/resumen
```

mientras el backend declara:

```text
ADMINISTRATIVO
FINANZAS
```

El maestro puro no tiene ese permiso.

El dashboard debería ser diferente por rol.

### ADMINISTRATIVO

Podría ver:

```text
Alumnos activos
Docentes
Grupos
Eventos
```

### FINANZAS

```text
Saldo pendiente
Cobrado
Adeudos
Pagos
```

### MAESTRO

```text
Mis grupos
Materias
Actividades próximas
Entregas pendientes de calificar
Periodos pendientes
```

Esto además mejoraría mucho el UX: actualmente el mismo concepto de dashboard intenta servir a roles con trabajos completamente diferentes.

---

# 2. La lógica de inscripción necesita una regla escolar adicional

Actualmente se valida:

```text
¿El alumno ya está en ESTE grupo?
```

pero no:

```text
¿El alumno ya está inscrito activamente
en OTRO grupo del mismo ciclo?
```

Para una escuela tradicional eso puede dejar:

```text
Carlos
Ciclo 2026-2027

1-A ACTIVA
1-B ACTIVA
```

Después:

```text
Materias 1-A
+
Materias 1-B
+
Tareas 1-A
+
Tareas 1-B
+
Calificaciones
```

terminan coexistiendo.

Antes de modificar esto hay que confirmar una decisión de negocio:

**¿Un alumno puede pertenecer a más de un grupo académico principal en el mismo ciclo?**

Mi recomendación para el modelo actual es **no**.

Si posteriormente existen talleres/optativas, no deben modelarse haciendo que el alumno pertenezca a dos grupos base.

---

# 3. El grupo debería ser mucho más inmutable

Actualmente puede modificarse `cicloId`.

Eso es peligroso porque un grupo no está aislado.

Tiene:

```text
Grupo
 ├── inscripciones
 ├── grupo-materias
 ├── actividades
 ├── materiales
 ├── entregas
 └── calificaciones
```

Mover el grupo de:

```text
2026-2027
```

a:

```text
2027-2028
```

cambia implícitamente el contexto histórico de todo lo que cuelga de él.

### Recomendación

Después de que exista la primera inscripción o actividad:

```text
cicloId = INMUTABLE
plantelId = INMUTABLE
```

Se podrían seguir corrigiendo:

```text
nombre
grado
turno
```

según las reglas definidas.

---

# 4. Planteles también necesitan ciclo de vida

Actualmente SUPERADMIN puede cambiar:

```text
activo = false
```

sin comprobar:

```text
¿Tiene alumnos activos?
¿Tiene grupos activos?
¿Tiene docentes?
¿Tiene cobros?
¿Tiene director?
```

No debería ser un simple booleano editable.

Debe parecerse a:

```text
Solicitar cierre de plantel
        ↓
validar dependencias
        ↓
bloquear altas nuevas
        ↓
cerrar grupos
        ↓
resolver personal
        ↓
desactivar
```

Para piloto puede simplificarse:

> No permitir desactivar si existen alumnos o grupos activos.

---

# 5. “Pago a cuenta” necesita corregirse antes de que Finanzas lo use

Este es uno de los hallazgos que más priorizaría.

La web dice:

```text
Cargo (opcional)

Pago a cuenta
```

Pero el backend cuando no recibe cargo guarda:

```text
cargoId = null
estatus = CONFIRMADO
```

y deliberadamente registra:

```text
pago_no_aplicado
```

No reduce el saldo del alumno.

Por tanto puedes tener:

```text
Saldo anterior: $5,000

Finanzas registra:
Pago a cuenta $1,000

Sistema:
Pago confirmado $1,000

Saldo:
$5,000
```

Eso operativamente es muy peligroso.

### Para piloto haría lo simple

Eliminar temporalmente:

```text
Pago a cuenta
```

y obligar:

```text
Pago → Cargo
```

Más adelante puede implementarse formalmente:

```text
Saldo a favor
    ↓
aplicación de crédito
    ↓
cargo
```

con su propia bitácora.

---

# 6. Estado de cuenta móvil necesita distinguir dinero confirmado de dinero pendiente

El API devuelve:

```text
estatus
```

del pago.

Pero la interfaz móvil no lo define ni lo muestra.

Actualmente el alumno ve principalmente:

```text
$2,800
TARJETA · 07/10/2026
```

Necesita algo tipo:

```text
$2,800
Tarjeta

✓ Confirmado
```

o:

```text
⏳ Pendiente
```

o:

```text
✕ Fallido
```

Esto tiene que coincidir además con el saldo mostrado.

---

# 7. El proxy IIS requiere una corrección específica

La configuración del VPS está correctamente planteada:

```text
Internet
   ↓ HTTPS
IIS / ARR
   ↓
127.0.0.1:3000
NestJS
```

Pero Nest no configura actualmente `trust proxy`.

Eso afecta:

```text
@Ip()
req.ip
rate limiting
bitácoras
Openpay clienteIp
```

Podría hacer que todo parezca venir de:

```text
127.0.0.1
```

Esto debe probarse en el VPS antes del piloto.

No pondría `trust proxy=true` indiscriminadamente.

Como Nest escucha exclusivamente en `127.0.0.1`, puede confiar específicamente en el proxy local y validar que ARR conserve correctamente `X-Forwarded-For`.

---

# 8. Validación de datos todavía necesita endurecimiento

Hay una diferencia clara entre los DTO más nuevos y varios DTO históricos.

`PlantelesDto`, por ejemplo, ya tiene:

```text
MaxLength
MinLength
Matches
```

Pero en Alumno hay cosas como:

```text
@IsString()
nombre
```

aunque la entidad tiene una longitud física determinada.

Lo mismo ocurre en:

```text
apellido
matrícula
CURP
teléfono
dirección
clave de materia
nombre de materia
grupo
ciclo
```

### Debe hacerse coincidir DTO ↔ entidad

Ejemplo:

```text
Entidad:
nombre VARCHAR(80)

DTO:
@IsString()
@MinLength(1)
@MaxLength(80)
```

También:

```text
fechaNacimiento
fechaInicio
fechaFin
fechaEntrega
```

deberían validarse como fechas reales, no únicamente como strings.

Y:

```text
fechaInicio <= fechaFin
```

debe validarse como regla de negocio.

---

# 9. Normalización de datos

También agregaría una capa pequeña pero importante antes del piloto.

Normalizar:

```text
Email:
Trim + lowercase

CURP:
Trim + uppercase

Matrícula:
Trim

Claves:
Trim + uppercase

Nombres:
Trim
```

Actualmente un usuario puede intentar registrar cosas como:

```text
"  alumno@escuela.mx "
"MAT-101 "
" A-2026-001"
```

Eso genera búsquedas, duplicados y comparaciones más difíciles.

La normalización debe estar en backend, no depender del frontend.

---

# 10. Cargas de archivo requieren inspección real del contenido

Actualmente el filtro hace:

```text
archivo.pdf
→ extensión .pdf
→ aceptado
```

pero un archivo se puede renombrar.

Para el piloto público haría:

```text
extensión permitida
+
MIME permitido
+
firma binaria compatible
```

Especialmente para:

```text
PDF
imágenes
Office
ZIP
```

No agregaría una dependencia nueva automáticamente. Primero evaluaría una biblioteca ligera y mantenida frente a una implementación mínima propia para los formatos realmente aceptados.

---

# 11. Hay PII en un log de SMTP simulado

Actualmente:

`notificaciones.service.ts:98`

registra:

```text
[EMAIL simulado] para=<email> asunto="<subject>"
```

Eso contradice el objetivo de no dejar datos personales en logs.

En staging deberían registrarse únicamente cosas como:

```text
EMAIL_SIMULADO generado
```

sin:

```text
email
nombre
matrícula
calificaciones
```

---

# 12. Calendario necesita paginación o ventana temporal

El servicio termina en:

```text
.take(500)
```

Si se llama sin rango temporal y existen años de datos:

```text
500 eventos antiguos
```

podrían desplazar eventos posteriores.

Recomiendo que la pantalla principal siempre consulte:

```text
desde
hasta
```

y que el historial sea paginado.

---

# 13. Openpay sigue necesitando una pantalla de conciliación

La lógica defensiva backend es bastante buena.

Cuando existe ambigüedad hace correctamente:

```text
requiere conciliación
```

El problema es operacional:

**¿Dónde lo resuelve Finanzas?**

Hoy existe el concepto, pero falta convertirlo en un proceso de usuario.

Necesitamos algo como:

```text
Conciliación de pagos

ORD-182
Alumno
Cargo
Monto local
Monto proveedor
Estado
Fecha

[Consultar proveedor]
[Aplicar]
[Marcar revisado]
```

con bitácora.

Sin esto, una incidencia requiere ir a base/logs.

---

# 14. Las órdenes Openpay necesitan política de limpieza/reconciliación

`ordenes.service.ts:48-78` protege correctamente contra crear dos cargos Openpay accidentalmente.

Pero una orden:

```text
CREADA
```

o:

```text
PENDIENTE
```

que queda sin webhook puede bloquear intentos posteriores hasta una conciliación.

Eso es correcto desde seguridad financiera, pero falta el proceso operativo que la libere.

Necesitamos distinguir:

```text
PENDIENTE válida
EXPIRADA
REQUIERE CONCILIACIÓN
FALLIDA
COMPLETADA
```

y una forma segura de resolver cada estado.

---

# 15. Falta una prueba de carga mínima

Ahora hay buenas pruebas funcionales, pero no encontré pruebas de estrés/carga.

Para el piloto no necesitamos probar 100,000 alumnos.

Sí probaría algo realista como:

```text
500 alumnos
30 maestros
10 administrativos

20-40 usuarios concurrentes
```

con operaciones:

```text
login
consultar dashboard
abrir grupo
capturar 30 notas
ver tareas
consultar estado de cuenta
generar PDF
generar Excel
```

Y mediría:

```text
p50
p95
errores
CPU
RAM
consultas lentas
```

antes de optimizar nada.

---

# 16. Observabilidad

Actualmente hay bitácoras y logs, pero falta algo que parece pequeño y ayuda muchísimo:

```text
requestId
```

Ejemplo:

```text
REQ-8F31A
```

y que aparezca en:

```text
IIS
Nest
error
bitácora técnica
```

Cuando el administrativo diga:

> “A las 10:32 intenté guardar calificaciones y falló.”

podrás encontrar exactamente esa petición.

---

# 17. Swagger no está terminado como contrato técnico

Swagger está correctamente habilitado fuera de producción.

Pero los controladores básicamente usan:

```text
@ApiTags
@ApiBearerAuth
```

y los DTO.

No encontré documentación detallada de cada operación mediante contratos tipo:

```text
qué hace
qué roles
200/201
400
401
403
404
409
```

Esto no bloquea el piloto, pero sí debe cerrarse antes de llamar a la API completamente documentada.

---

# 18. Health check mejorable

Actualmente:

```text
GET /api/health
```

solo comprueba:

```text
SELECT 1
```

Está bien como mínimo.

Para operación dejaría:

```text
/health/live
```

Nest está vivo.

y:

```text
/health/ready
```

DB disponible y configuración crítica cargada.

También devolvería la versión:

```text
1.14.0
```

sin exponer datos internos.

---

# 19. Cobertura frontend todavía es muy pequeña

El número actual de pruebas es bueno como comienzo, pero la Fase 1 reporta aproximadamente:

```text
Backend: 126
Web: 8
Móvil: 4
```

Para el riesgo actual del proyecto, ya no agregaría primero más tests unitarios genéricos del backend.

Agregaría pruebas exactamente sobre bugs de negocio:

```text
dashboard de MAESTRO no hace 403
pago sin cargo
cambio de ciclo de grupo
doble inscripción del ciclo
plantel con grupos activos
calendario de grupo
promedio/calificaciones por ciclo
boleta por ciclo
```

Y en web:

```text
ADMIN
MAESTRO
FINANZAS
SUPERADMIN
```

---

# 20. Algo que confirmé que SÍ está bien

Revisé nuevamente el detalle de alumno porque inicialmente parecía que MAESTRO/FINANZAS podían recibir demasiados datos.

El código actual **sí está bien en este punto**.

`AlumnosService.obtenerParaApi()` devuelve a Maestro/Finanzas solo:

```text
id
matrícula
estatus
plantel
nombre
apellidos
```

y reserva:

```text
CURP
fecha nacimiento
tutor
teléfono
dirección
email
```

para:

```text
ADMINISTRATIVO
SUPERADMIN
```

Eso respeta mucho mejor el principio de mínimo privilegio. No lo cambiaría.

---

# Qué sigue pendiente de la auditoría anterior

Además de estos nuevos hallazgos, siguen pendientes varios bloques que ya habíamos identificado:

| Pendiente anterior                           | Estado                   |
| -------------------------------------------- | ------------------------ |
| Transiciones correctas BAJA/EGRESADO/docente | 🔴 Pendiente             |
| Contexto académico por ciclo                 | 🔴 Pendiente             |
| Calendario por grupo correctamente aislado   | 🔴 Pendiente             |
| Calificaciones del alumno sin mezclar ciclos | 🔴 Pendiente             |
| Boleta por ciclo                             | 🔴 Pendiente             |
| Privacidad de boleta para MAESTRO            | 🔴 Pendiente             |
| Excel incluyendo alumnos sin nota            | 🟠 Pendiente             |
| Refresh token/sesiones por dispositivo       | 🟠 Pendiente             |
| Token web fuera de `localStorage`            | 🟠 Pendiente             |
| Edición/corrección completa desde web        | 🟠 Pendiente             |
| Búsqueda paginada en selectores              | 🟠 Pendiente             |
| Cancelación de cargos                        | 🔴 Pendiente             |
| Anulación/reversión de pagos                 | 🔴 Pendiente             |
| Conciliación Openpay                         | 🔴 Pendiente             |
| Build EAS firmado/dispositivo físico         | 🔴 Pendiente             |
| Backup + restore real                        | 🔴 Pendiente             |
| Staging VPS certificado                      | 🔴 Pendiente             |
| SMTP real                                    | 🟠 Pendiente             |
| ETL completo certweb                         | Según alcance del piloto |

---

# Plan actualizado

Como la antigua Fase 1 ya terminó, yo reorganizaría lo que queda en **cuatro fases**, no cinco.

| Fase                                              | Trabajo                                                                                                         | Resultado                                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Fase 2 — Integridad del dominio**               | ciclos, grupos, doble inscripción, alumnos/docentes, planteles, materias, calendario, dashboard por rol         | La estructura escolar no puede quedar en estados imposibles                   |
| **Fase 3 — Académico y calificaciones**           | actividades, ponderación, periodos, notas por ciclo, boleta, Excel, alumno/maestro/admin                        | Una sola verdad académica en todas las interfaces                             |
| **Fase 4 — Finanzas, seguridad y UX operacional** | pago a cuenta, cancelaciones, reversos, conciliación, proxy IIS, uploads, DTO, búsquedas y flujos de corrección | El personal puede operar sin depender de Swagger/DB y sin errores financieros |
| **Fase 5 — Certificación del piloto**             | VPS, restore, SMTP, Openpay sandbox, EAS, dispositivos, carga, roles, accesibilidad, monitoreo                  | Gate formal `PILOTO LISTO`                                                    |

## Mi prioridad exacta ahora

Si vamos a continuar trabajando código, comenzaría la **Fase 2** con este orden interno:

**Dashboard MAESTRO → transiciones alumno/docente → contexto de ciclo → inscripción única por ciclo → grupo inmutable → ciclo de vida del plantel/materia → calendario por grupo.**

Después iría directamente a calificaciones/boletas.

## Conclusión

El proyecto **ya tiene un baseline técnico serio**. La CI verde en MySQL y SQL Server elimina una incertidumbre importante.

Pero todavía **no lo liberaría a piloto con usuarios reales** porque hay varias reglas que podrían producir problemas difíciles de reparar después: doble inscripción en el mismo ciclo, cambio de ciclo de un grupo con historial, “pago a cuenta” que no disminuye saldo, planteles/materias desactivables sin resolver dependencias, dashboard del maestro con una petición no autorizada y falta de manejo correcto del proxy IIS.

Mi estimación actual es que ya no falta construir el sistema central: **falta endurecer y cerrar aproximadamente el último 15–20% que convierte un MVP funcional en un piloto operable de forma segura**.
