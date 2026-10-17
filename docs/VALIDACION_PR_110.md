# Planificador regular — PR 110

`planificarGruposRegulares(cantidad)` es una función pura para una cohorte nueva
previamente validada. Conserva todos los alumnos: 0–4 quedan pendientes; los grupos
ordinarios tienen 5–50; un remanente de 1–4 se incorpora al último grupo completo,
con tamaño excepcional de 51–54. Por ejemplo: 54 → [54], 55 → [50,5].

Se verifican los límites 0/1/2/3/4/5/49–55/99–105/150, entradas inválidas y
conservación/límites en todas las cantidades de 0 a 10,000. Cada llamada produce
un plan independiente. El resultado no representa una orden de redistribución.

## Dependencia de integración operativa

No existe aún un módulo de apertura de cartera ni el contexto completo de nivel,
carrera/plan, periodo y modalidad en Grupo. Las incidencias #97/#98/#100 definen
esas dependencias y contienen decisiones institucionales pendientes. Este PR no
inventa ese modelo, precios o permisos, ni habilita una API de asignación parcial.

El futuro llamador debe:

- Ejecutar solamente desde apertura de cartera ordinaria, validando plantel,
  nivel, carrera/plan, ciclo, periodo, turno y modalidad regular compatible.
- Excluir grupos especiales y participaciones de recursamiento; respetar selección
  manual y grupo principal del alumno.
- Persistir pendientes sin crear grupos regulares activos con menos de cinco.
- Usar transacción, exclusión concurrente e idempotencia; confirmar cargos según
  reglas del backend una sola vez, con auditoría y rollback.
- Conservar grupos con historial. La transición de un grupo vivo de 54 a 55
  requiere propuesta/revisión administrativa según política aprobada, no aplicar
  automáticamente el plan [50,5].
- Validar en MySQL y SQL Server concurrencia, reintento, permisos, compatibilidad,
  bajas/traslados y rollback, con una UI que explique pendientes y excedentes.

El merge de la función no activa ni completa #99/#100. Estas incidencias siguen
abiertas; no se modifican alumnos, inscripciones, cargos, grupos ni esquema.
