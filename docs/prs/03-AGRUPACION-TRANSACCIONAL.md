# Agrupación automática — integración operacional

## Código comprobado
`backend/src/academico/distribucion-grupos.ts` contiene `planificarGruposRegulares(cantidad)` y la suite `distribucion-grupos.spec.ts` comprueba 0–10 000 alumnos. La función es pura: **no crea grupos ni inscripciones**. No se invoca desde una apertura de cartera inexistente.

## Siguiente implementación, por archivos
- `backend/src/academico/grupos.service.ts` y `inscripciones.service.ts`: coordinador desde **apertura ordinaria**; no desde altas, recursamiento ni programas especiales.
- `backend/src/entities/grupo.entity.ts` y entidades de inscripción: representar compatibilidad plantel/nivel/carrera/periodo/turno sin modificar claves históricas.
- Migraciones espejo MySQL/SQL Server cuando #97 establezca modelo definitivo.
- `backend/test/integration/academico.cases.ts`: transacciones, concurrencia, autorizaciones, idempotencia y cargas financieras.

## Invariantes
- Grupo ordinario nuevo mínimo 5, máximo normal 50. Remanente 1–4 se agrega solo a grupo ordinario compatible, permitiendo 51–54.
- Cohorte sin destino compatible y de menos de 5 queda **pendiente**, sin crear grupo activo.
- No reasignar grupos existentes con notas, pagos o clases: transición 54→55 requiere propuesta explícita o política aprobada.
- Ninguna reejecución crea dos grupos/inscripciones ni repite cargos.
- No incluir programas especiales ni recursantes en conteos de cartera regular.

## Aceptación
Casos 4/5/49–55/99–105, plantel/plan/turno cruzados, 2 aperturas paralelas, rollback de error, recuperación tras caída, inserción idempotente y sin cupos falsos.

## Dependencias
#97, #98 y el flujo de #100. Este PR inicia la especificación; **todavía no activa el algoritmo**.
