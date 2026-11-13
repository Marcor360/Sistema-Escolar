# Journey UX/UI de academia, expedientes y finanzas — 13 de noviembre de 2026

## Corte, alcance y evidencias

Base auditada: `main` 1.37.0, commit `90ebeb7701b9227cd706067a2f203a8e6e4f53d5`. Revisión estática de README, paquetes y entornos de backend/web/mobile, DTOs, entidades, servicios, rutas, formularios, guías, pruebas y migraciones relevantes a academia/cartera/finanzas. No equivale a una ejecución E2E de **todo** el monorepo ni a UAT institucional.

`PR #245` (1.38.0) fue fusionado a `feat/importaciones-preparacion-grupos`, **no a main** en este corte. Su contrato `docs/APERTURA_FLEXIBLE_Y_PERSONAL_1.38.0.md` describe la apertura con plan/periodo pendientes y avisos derivados. La versión 1.37.0 del servidor no incluye esas funciones.

## Modelo mental y restricciones

- **Guardar** crea un registro identificable sin simular que ya está operativo.
- **Configurar** vincula, cuando existen, contexto, personas y relaciones. La ausencia permitida se muestra como pendiente, no como error de alta.
- **Operar** (inscribir formalmente, impartir una clase, cerrar calificaciones, emitir cargos, aplicar pagos) exige las reglas de autorización, ciclo, plantel, integridad e idempotencia aplicables.
- **Corregir** utiliza PATCH o una operación administrativa auditada; no se edita retroactivamente un pago para ocultar su historia ni se elimina una materia/grupo con actividad histórica.
- Todas las acciones del personal son web; Expo y su portal son solo de ALUMNO. La API NestJS decide las reglas.

### Dependencias y secuencia recomendada

| Registro/acción | Datos mínimos | Puede faltar al guardar | Condición para operación posterior |
| --- | --- | --- | --- |
| Plantel | Clave y nombre institucional | Director, profesores, grupos, alumnos | Plantel activo y usuario autorizado |
| Nivel académico del plantel | Clave, nombre, plantel | Carrera/plan, grupos, alumnos | Nivel activo y compatible con plantel |
| Carrera o plan | Plantel, nivel, clave, nombre, versión | Materias, profesor, alumnos | Nivel/plan activos |
| Periodo académico | Plantel, plan, ciclo, tipo y número | Fechas opcionales en alta según DTO | Contexto compatible; fechas para reinscripciones cuando se necesiten |
| Ciclo | Clave, nombre, fecha inicio/fin | Grupos, materias y alumnos | PREPARACION permite configurar; ACTIVO permite operación vigente |
| Materia global | Clave y nombre | Plantel, plan, créditos, grupo, docente | Vincular después a planes y grupos |
| Grupo regular | Plantel, ciclo, nombre | Contexto nivel/plan/periodo completo, materias, docente, alumnos | Ciclo/plantel activos o en preparación para configurar; validar inscripciones y cobros aparte |
| Materia de un grupo | Grupo y materia activa | Docente | Docente activo, asignado al plantel, antes de impartir |
| Expediente alumno | Identidad y plantel según alta | Inscripción, grupo y cartera | Validación de identidad, alcance y condición académica |
| Apertura de cartera 1.37.0 | Alumno, plantel, ciclo, nivel, plan, periodo, concepto(s), calendario | Grupo (puede quedar en pausa) | Cotización, confirmación, agrupación y cargos seguros |
| Apertura de cartera 1.38.0 en rama | Plantel, ciclo y nivel | Plan, periodo y grupo | En pausa sin cargos hasta completar contexto y confirmar |
| Concepto de cobro | Clave, nombre, tipo admitido, monto base | Tarifa autorizada (puede ser 0 para preparación) | Tarifa positiva y concepto activo antes de emitir cargos |
| Cargo adicional | Alumno, concepto permitido, descripción, monto positivo | Fecha de vencimiento y descuento según DTO | Idempotencia y alcance por plantel; **no** es una colegiatura ni un pago |
| Colegiatura/programación | Plantel/ciclo, concepto, modalidad, total y calendario según flujo | El cargo puede no estar emitido mientras solo exista programación | Revisar inscripción, periodo, vigencia y duplicados antes de emitir |
| Pago | Cargo o movimiento cotejado y datos exigidos por el medio | — | Verificar transacción/folio y registrar evento auditable e idempotente |

**Ejemplo sin datos completos:** crear plantel → nivel Licenciatura → plan Ingeniería en Sistemas → ciclo → grupo 1-A sin docentes ni materias → registrar materias → asignarlas al grupo sin docente → completar profesores más tarde. Ningún paso debe crear matrícula, clase, inscripción o cargo por inferencia.

**Ejemplo de Maestría:** crear nivel Maestría por plantel, registrar su programa/plan y periodos. «Carreras y planes» es el nombre técnico del catálogo, no una obligación de llamar licenciatura a un posgrado. No inventar catálogos ni planes oficiales.

## Journey por rol y momentos de uso

| Rol | Entrada | Acción principal | Confirmación / siguiente paso |
| --- | --- | --- | --- |
| SUPERADMIN | Planteles, usuarios, configuración | Crear sede, autorizar alcance y activar ciclos | Consultar personal y preparación académica; no generar cobros |
| ADMINISTRATIVO | Catálogos académicos, materias, grupos | Preparar oferta y asignaciones progresivas | Mostrar sin materias/sin docente/sin periodo, con acceso a Administrar |
| ADMINISTRATIVO / FINANZAS según permiso | Expedientes, apertura de cartera | Registrar alumno, verificar identidad, preparar apertura | Estado explícito PAUSA/PENDIENTE/ABIERTA; no duplicar alumnos ni emitir cargos sin condición |
| FINANZAS | Conceptos → cargos/programaciones → pagos | Autorizar tarifa, previsualizar colegiaturas, emitir, registrar pago | Mostrar diferencia entre concepto, cargo, pago, anulación y conciliación |
| MAESTRO | Mis grupos y clases | Trabajar únicamente con materias efectivamente asignadas | Sin acceso por simple existencia de grupo ni funciones financieras |
| ALUMNO | Expo / portal | Consultar sus propias materias, tareas, documentos y adeudos | Estados vacíos, error, carga; sin funciones de gestión |

## Estados de preparación y recordatorios

Usar **indicadores calculados** a partir de la información existente, no bloquear altas ni almacenar señales redundantes sin justificación. Un mensaje debe decir qué falta y a dónde ir:

| Condición | Etiqueta accesible | Acción propuesta | Bloqueo |
| --- | --- | --- | --- |
| Grupo sin materia | «Pendiente: agregar materias» | Administrar grupo → asignar materias | No bloquea alta; revisar antes de impartir |
| Materia del grupo sin docente | «Pendiente: asignar docente» | Administrar → asignar/reasignar docente | No bloquea alta ni asignación de materia |
| Grupo sin contexto académico | «Pendiente: nivel, plan y periodo» | Editar grupo | No bloquea alta; sí operaciones que exijan contexto |
| Alumno sin grupo/apertura parcial | «Apertura en pausa» | Completar desde detalle | Sin cargos ni inscripción automática |
| Concepto con monto base cero | «Pendiente: definir tarifa» | Finanzas → conceptos | Impide usarlo en flujos que exigen monto positivo |
| Programación creada, cuota no emitida | «Programado, pendiente de emisión» | Revisar inscripción y emitir cuota | No mostrar como adeudo emitido |
| Cargo pendiente de pago | «Cargo emitido, pendiente de pago» | Ver saldo / ficha | No registrar ingreso hasta validar pago |
| Pago sin conciliar | «Pendiente de conciliación» | Conciliar con folio del banco | No asociar a otro cargo sin revisión |

Los recordatorios al consultar son una primera etapa. Notificaciones automáticas periódicas por correo/WhatsApp requieren diseño de audiencia, consentimiento, preferencias, prevención de duplicados y pruebas separadas. No enviar masivamente a menores ni terceros por defecto.

## Hallazgos y acciones

| ID | Severidad | Hallazgo con ubicación | Impacto | Corrección |
| --- | --- | --- | --- | --- |
| UX-01 | Alta | `backend/src/cartera/cartera.dto.ts:5-17` requiere carrera y periodo en la apertura 1.37.0 | Impide terminar apertura parcial con datos ausentes | Integrar y validar separadamente la solución 1.38.0 del PR #245; no relajar la emisión de cargos |
| UX-02 | Media | `web/src/pages/CatalogosAcademicos.tsx:10-42,85-104` ofrecía nombres genéricos sin ejemplos por nivel | Dudas entre licenciatura, maestría, plan y periodo | **Corregido en este PR:** ayudas contextualizadas |
| UX-03 | Media | `web/src/pages/Materias.tsx:101-107` no explicitaba que materia es independiente de plantel/docente | Asignaciones prematuras | **Corregido:** texto junto al alta |
| UX-04 | Media | `web/src/pages/Grupos.tsx:243-270,329-337` no explicaba bien la preparación progresiva | Se percibe el alta como incompleta o bloqueada | **Corregido:** pendientes y siguiente acción |
| UX-05 | Media | `web/src/components/CatalogoConceptos.tsx:10-38` no distinguía estado vacío y carga ni ofrecía reintento explícito | Dificultad para recuperar errores de consulta | **Corregido:** carga, vacío y reintento |
| UX-06 | Media | `web/src/features/finanzas/PanelCargos.tsx:50` admitía 0 en input; `backend/src/finanzas/finanzas.dto.ts:54` exige monto >= 0.01 | Validación inconsistente entre cliente/API | **Corregido:** mínimo 0.01; backend conserva la autoridad |
| UX-07 | Baja | `web/src/features/finanzas/PanelCargos.tsx:87` tenía colSpan=7 con 8 columnas | Estructura de tabla vacía incorrecta | **Corregido:** colSpan=8 |
| UX-08 | Media | `web/src/components/recorrido-por-rol.ts:82-135` omitía la revisión previa de conceptos | Se salta autorización de tarifa en el journey financiero | **Corregido:** paso de conceptos |
| UX-09 | Alta, riesgo por verificar | `backend/src/finanzas/conceptos.service.ts:27-33` permite PATCH de tipo/monto sin revisar explícitamente referencias a cargos existentes | Cambios de clasificación de un concepto podrían alterar interpretación futura de registros | Proponer inmutabilidad del tipo cuando existan cargos y pruebas MySQL/SQL Server; preservar monto histórico de `Cargo` |
| UX-10 | Media | `web/src/features/finanzas/ConfirmarProgramacion.tsx:93-105` exige contexto válido para autorizar programación y su emisión | Usuarios con expediente parcial necesitan una explicación contextual | Diseñar estado de preparación sin emisión; **no** crear cargos ni levantar bloqueos contables |
| UX-11 | Media | `web/src/components/recorrido-por-rol.ts` y `docs/CARGA_ACADEMICA_GUIADA.md` presentan rutas recomendadas pero no auditan todas las secuencias reales con BD | Riesgo de pasos que dependen de catálogos inexistentes | Ejecutar UAT por nivel, rol, ciclo, plantel, pagos e inscripción en una BD aislada |
| UX-12 | Media | `backend/src/finanzas/programaciones.ts` define secundaria 1 cuota, bachillerato 2 y superior 4 por cuatrimestre | La periodicidad puede no coincidir con un plan institucional específico | Validar política aprobada por nivel y calendario antes de generalizar o hacer configurable; no cambiar tarifas automáticamente |

### Aceptación requerida para PR(s) posteriores

1. Alta de plantel sin usuarios y nivel sin planes; catálogo de materia global sin profesor.
2. Grupo sin contexto y sin asignaciones: visible, editable y marcado como pendiente, sin impedir preparar otros grupos.
3. Asignar materia sin docente; completar después con profesor del plantel; impedir profesor ajeno.
4. Crear expediente sin inscripción y reanudar apertura parcial de 1.38.0 sin duplicar alumno/cartera.
5. Crear concepto con monto 0, corregir tarifa y confirmar que cargos anteriores no se recalculan.
6. Programar secundaria, bachillerato y superior; comprobar cada periodo y cuota, cancelaciones, pagos parciales y conciliación.
7. Asegurar que rol MAESTRO no accede a Finanzas y que ALUMNO solo consulta sus propios datos en Expo.
8. Comprobar carga, vacío, error, éxito, teclado, pantalla 360/768/1280/1920 px y consultas con datos reales autorizados.
9. Ejecutar lint, typecheck, build, tests web/backend y suites de integración MySQL/SQL Server antes de integrar. Las pruebas locales y de CI deben asociarse al SHA final.

## Límites de este PR

Se modifica **solo web** (textos orientativos, validación HTML, estados de catálogo, recorrido y pruebas) y este documento. No hay migraciones, nuevas dependencias, endpoints, cambios de permisos, pagos, tarifas ni datos institucionales. No se publica en staging.

La integración de 1.38.0 y el estudio del histórico financiero requieren PR independientes y aprobación institucional.
