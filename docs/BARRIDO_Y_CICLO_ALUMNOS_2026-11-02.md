# Barrido del repositorio y ciclo de alumnos · 1.35.15

Fecha: 2/nov/2026. Base examinada: main 1.35.14,
`c10da9ab884404bebfd439c336ff92f197392da5` (#240 integrado).
El SHA final y CI de esta entrega se registran en su PR para evitar incluir un
hash autorreferente en el propio commit.

## Alcance y método

Se contrastaron versiones, manifiesto de migraciones espejo, enlaces documentales
y llamadas de clientes frente a controladores reales. Se revisaron directamente
los controladores/DTO/servicios y clientes de alumnos, usuarios, activación,
recuperación y eliminación, junto con las pruebas de cartera y academia.
El barrido transversal automatizado no equivale a revisar manualmente cada línea
ni a certificar ausencia total de errores.

Se añadieron seis casos integrados con identidades ficticias independientes en
`backend/test/integration/ciclo-alumno.cases.ts`, registrados en la batería
general. Las bases nuevas solo aceptan el prefijo `escolar_integration_`, usan
baseline y migraciones con `DB_SYNC=false`. No se apuntó a staging, producción o
un origen legado; no se emitieron correos ni cobros reales.

## Hallazgos corregidos

| ID | Gravedad | Qué fallaba y por qué | Corrección |
| --- | --- | --- | --- |
| A01 | Alta condicionada a baja/retorno | Un código de activación todavía vigente emitido antes de la baja se aceptaba después de reactivar. La versión de sesión cambiaba, pero los códigos no la almacenan y seguían sin usar. | `UsuariosService.actualizarBloqueado` invalida activaciones y recuperaciones pendientes en la misma transacción que cambia estado/contraseña/roles. El outbox ya valida su versión propia. |
| A02 | Alta condicionada a posesión de código anterior | La recuperación de contraseña también aceptaba un código previo a baja/reactivación. Se reprodujo un cambio de contraseña con ese código. | Misma revocación transaccional; solicitar un código nuevo tras el retorno. No se invalidan códigos por corregir solo datos de contacto. |
| A03 | Media, trazabilidad | Tres espacios cumplían la longitud mínima del motivo y reactivaban un alumno sin justificación legible. | Normalizar espacios antes de validar `ReactivarAlumnoDto`; pruebas de blanco, tabuladores, motivo corto y motivo válido. |
| D01 | Media, documentación operativa | Índice señalaba reinscripción implementada como pendiente; API atribuía alta tradicional a Administración; README mostraba varias entregas integradas como candidatas actuales y describía una bandera que ya no cambia la inscripción. | Índices, contrato API de alumnos, estado y versión actual separados del historial. |
| D02 | Baja, mantenimiento | Tres propuestas sustituidas repetían bloqueos que ya no describen el contrato vigente; dos ramas de código de alumnos eran inalcanzables. | Retirada recuperable de propuestas y eliminación de comprobación posterior a rechazo de plantel en PATCH y ternario posterior a asignar EGRESADO. |

A01/A02 requieren que alguien conserve un código anterior todavía no vencido; no
implican acceso anónimo general ni exposición pública de esos códigos. La baja
seguía impidiendo acceso mientras la cuenta permanecía inactiva. La falla estaba
en devolver validez al código después del retorno.

Antes de corregir: seis casos aún no estaban presentes; sobre los cinco primeros
casos añadidos se observaron **3 fallos y 2 aprobados**. Los tres fallos anteriores
se reprodujeron con sus aserciones esperadas, no se dedujeron solo de lectura.
Después de corregir, los cinco primeros pasaron en MySQL. Se añadió un sexto
control para comprobar que corregir contacto no revoca una activación válida.

## Recorrido paso a paso y explicación

Estos resultados se acreditan mediante las baterías indicadas abajo; no son una
aceptación institucional de interfaz, proveedores o datos reales.

| Paso | Comprobación y motivo del resultado esperado | Evidencia técnica |
| --- | --- | --- |
| Alta tradicional | FINANZAS/SUPERADMIN crea cuenta pendiente y expediente; no elige una contraseña predecible. CURP/matrícula/correo duplicados producen 409 sin otra cuenta. | Nuevo caso de identidad; casos existentes de identidad/altas |
| Alta sin correo | Control Escolar confirma alumno y cartera atómicamente; PAUSA no emite cargos. Correo se asigna después con alcance. | `cartera-integral.cases.ts` |
| Activación | Código privado vigente permite elegir contraseña. Un código anterior a baja/retorno falla; uno nuevo funciona. | Nuevo caso de activación |
| Consulta y privacidad | Resumen financiero no expone expediente personal completo; maestros ven sus alumnos y el alumno solo lo propio. | `identidad.cases.ts`, `academico.cases.ts` y recorridos paginados |
| Corrección | PATCH normaliza identidad permitida y rechaza CURP vacía; no cambia estado/plantel por esa ruta. Editar contacto conserva activación pendiente válida. | Nuevos casos de identidad/contacto; pruebas de DTO |
| Inscripción/cartera | Preview no escribe; confirmación idempotente no duplica cargos/operaciones. Grupo inactivo y alumno BAJA se rechazan. | Cartera integral, reinscripciones por periodo y académico |
| Notas y cierre | Docente autorizado captura según régimen; cierre/publicación exigen condiciones y conservan originales. | Evaluaciones y recorrido académico existentes |
| Pago parcial | Pago sintético por 40 de un cargo de 100 queda registrado una vez; el traslado no mueve el cargo del plantel de origen. | Nuevo recorrido de vida y batería financiera |
| Transferencia | Exige permisos sobre origen y destino; termina inscripción anterior y mantiene historial. No asigna grupo nuevo automáticamente. | Nuevos casos de identidad/vida y recorrido académico |
| Baja | Desactiva alumno/cuenta/inscripciones y rechaza JWT anterior. Repetición responde 409; no borra historial. | Nuevo recorrido de vida y casos de identidad |
| Retorno | Exige motivo real; reactiva expediente/cuenta sin restaurar inscripciones ni JWT/códigos anteriores. Código nuevo de recuperación sí permite cambiar contraseña. | Nuevos casos de vida/recuperación |
| Egreso | Sin historial o con ciclo reciente abierto responde 409. Con antecedente cerrado registra un egreso y revoca acceso. | Nuevo caso de egreso; `egreso-alumno.spec.ts` |
| Egresado | No admite baja, reactivación ni egreso repetido; mantiene inscripción histórica y dato de egreso consultable. | Nuevo caso de egreso |
| Eliminación sin historial | SUPERADMIN con confirmación elimina expediente y cuenta/auxiliares; no queda acceso. | `eliminacion.cases.ts` |
| Eliminación con historial | Responde 409 y conserva expediente, pagos y antecedentes; rol local o falta de confirmación se rechazan. | Nuevos casos de vida/egreso y eliminación existente |

El nuevo recorrido prepara algunos antecedentes (grupo, inscripción y ciclo
cerrado) directamente en la base **ficticia** para aislar transiciones. Por sí
solo no demuestra el flujo de cierre o inscripción por interfaz; las baterías
existentes de cartera, evaluación y recorrido académico prueban esas operaciones.

## Limpieza: conservar, corregir o retirar

- Se conservan módulos operativos, dependencias, parches vendor, migraciones,
  baselines, respaldos, contratos vigentes y evidencias de UAT. No se encontró
  evidencia suficiente para borrar un módulo completo por estar sin uso.
- Se retiran las tres propuestas sustituidas enumeradas en [Historial](HISTORIAL.md),
  con enlace a su contenido original por SHA y sustituto vigente. Sus enlaces
  históricos ya no apuntan a archivos inexistentes.
- Los resúmenes de entregas integradas se concentran en [Historial de versiones](HISTORIAL_VERSIONES.md).
  README, índice y estado presentan la candidata actual. No se reescriben resultados históricos.
- `check-project-consistency.cjs` amplía el control de enlaces a documentación,
  guías móviles y skills; no comprueba enlaces externos, anclas ni significado de cada frase.
- Se retira de los ejemplos de entorno la bandera obsoleta de inscripción. Se mantiene su validación por compatibilidad con instalaciones anteriores; el servicio exige cartera independientemente de su valor y ya tiene regresión para ello.
- El ETL parcial se conserva identificado como tal. No se ofrece como migración
  general ni se elimina mientras pueda servir de base a un trabajo autorizado.

## Validación de entrega

Validación local de esta candidata:

- Backend: lint y typecheck aprobados; 636 pruebas unitarias y build aprobados.
- Web: lint, 285 pruebas y build aprobados con URL ficticia de API válida.
- Expo: 147 pruebas, 11 controles Node de configuración/auditoría y TypeScript aprobados.
- MySQL 8.4: batería integrada completa, 141 casos aprobados.
- Consistencia: 131 documentos, 353 llamadas de cliente y 356 rutas API; versiones
  y migraciones espejo aprobadas. Un enlace roto sintético bloqueó el control y,
  tras retirarlo, el control pasó.
- Skills y estructura UAT aprobadas; diez pruebas Node de contratos aprobadas.
  UAT conserva 69 escenarios pendientes y nueve puertas pendientes.

La integración SQL Server y CI por SHA final se registran al finalizar en el PR
  de esta candidata.
Los fallos iniciales de preparación del entorno se separan de los tres fallos
funcionales reproducidos: no se contabilizan como defectos de alumnos.

No hay cambios de esquema, nuevas dependencias ni migraciones. La revocación de
códigos usa las tablas existentes; un fallo revierte también la transición de
estado al compartir transacción. No se ejecutaron despliegues ni borrados de
expedientes institucionales.

## Qué falta para un piloto real

En la consulta de GitHub del 2/nov/2026, main continuaba con `protected=false`.
No se cambió la configuración remota. Protegerla, ensayar actualización y restore
de BD/uploads, validar IIS/ACL/antivirus, aceptar los recorridos con responsables
y preparar alertas/soporte siguen siendo condiciones de entrada.

La matriz añade UAT-69 **pendiente** para el ciclo de alumnos. No se aprueba por
ejecutar estas pruebas. [Plan de piloto](PILOTO_PRODUCCION.md) con orden,
responsables y criterios para continuar o detener. El objetivo es preparar un
piloto verificable; esta revisión no declara uno ya operando.
