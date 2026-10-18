# Agrupación automática — integración operacional

## Diagnóstico inicial
`backend/src/academico/distribucion-grupos.ts` contiene `planificarGruposRegulares(cantidad)` y la suite `distribucion-grupos.spec.ts` comprueba 0–10 000 alumnos. La función es pura: **no crea grupos ni inscripciones**. La integración operacional descrita abajo lo invoca exclusivamente desde la apertura ordinaria.

## Zonas del contrato de integración
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
#97 y #98 aportan el modelo; #100 conecta la cartera. El coordinador se integró en #117 y la apertura que lo invoca en #116. Las altas simples no disparan agrupación.

## Implementación
`AgrupacionRegularService` coordina exclusivamente solicitudes de apertura ordinaria dentro de la transacción compartida READ COMMITTED. Bloquea el plantel, valida los catálogos y el alumno, conserva solicitudes pendientes y crea grupos con el planificador existente. Reutiliza grupos regulares activos con exactamente el mismo contexto y turno, llena hasta 50 y permite solo remanentes hasta 54. No reequilibra grupos vivos: en la transición 54→55 el nuevo alumno queda pendiente hasta completar al menos cinco sin mover el historial.

No hay endpoint independiente que permita agrupar especiales o abrir cargos fuera de cartera. El módulo exporta el coordinador para #116; antes de esa integración no se activa desde una alta simple. Las solicitudes tienen unicidad alumno/ciclo y estados auditados; las de alumnos inactivos o trasladados se anulan antes de contar una cohorte. La prueba de integración comprueba espera 4→5, rollback completo, dos solicitudes paralelas, inscripción única y exclusión de FINANZAS. Migraciones incrementales equivalentes incluidas.
