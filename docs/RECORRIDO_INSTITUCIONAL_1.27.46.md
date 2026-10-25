# Recorrido integrado de alumno, grupo y colegiaturas

**Candidata 1.27.46**. Prueba de integración API y base aislada, en los dos motores. El mismo alumno sintético atraviesa alta, activación, inscripción y cobro.

1. Un administrativo registra expediente con proveedor Microsoft 365 y la cuenta permanece pendiente.
2. La utilidad de integración procesa el outbox con claves exclusivas de test, activa y obtiene una sesión de ALUMNO sin enviar correo real.
3. El administrativo abre un grupo regular del ciclo activo e inscribe al alumno.
4. FINANZAS previsualiza y genera la colegiatura `COL` por $375 MXN del periodo `2026-11`; la repetición no genera otro cargo.
5. Alumno y gestión autorizada consultan estado de cuenta; gestión de plantel ajeno recibe 403 y el alumno no puede entrar al endpoint administrativo.

**Código:** `backend/test/integration/recorrido-institucional.cases.ts`, registrado en `backend/test/critical-flows.integration-spec.ts`. Se ejecuta en `integration-mysql`, `integration-sqlserver` y `web-e2e` de la CI ya existente.

**Límites:** los E2E web con Playwright siguen en `backend/test/recorridos-web.ts`. Este caso integra las operaciones mediante API real, no incorpora nueva pantalla de navegador. No certifica correo entregado, Android/iOS físico, pasarela, aprobación institucional ni facturación automática. No toca staging ni producción. La UAT externa permanece pendiente.
