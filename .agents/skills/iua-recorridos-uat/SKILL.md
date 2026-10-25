---
name: iua-recorridos-uat
description: Diseñar y ejecutar recorridos UAT y E2E por rol, canal y plantel de IUA con Playwright y evidencias reproducibles en datos ficticios.
---
# Recorridos institucionales y E2E

## Preparación
1. Leer `docs/UAT_MATRIZ_2026-10-15.json`, `docs/BETA_ACEPTACION.json`, `docs/MATRIZ_ACCESO.md` y `backend/test/recorridos-web.ts`.
2. Seleccionar escenario y rol, precondiciones, datos ficticios, ruta, pasos, resultado esperado y criterios de seguridad.
3. Separar pruebas de interfaz con API simulada (`cd web && npm run test:responsive`) de recorridos reales en infraestructura AISLADA (`cd backend && npm run test:integration`). La segunda prueba requiere configuración dedicada y `RUN_DB_INTEGRATION=1`; nunca apuntar a staging o producción.
4. Utilizar Playwright disponible en `web`; verificar al menos 360, 768, 1280 y 1920 px, navegación por teclado, errores de red, estados vacíos, validaciones, roles denegados y ausencia de duplicados.
5. Recorrer: alta de alumno -> activación -> cartera -> grupos/asignación -> notas; docente -> tareas/notas; finanzas -> cargo/pago parcial/estado de cuenta; alumno Expo -> primeras sesiones y documentos. Respetar módulos y decisiones institucionales no aprobadas.
6. Los escenarios Android/iOS físicos, Microsoft 365, GoDaddy, Openpay real, antivirus e IIS requieren responsables y pruebas externas autorizadas; nunca marcarlos aprobados por ejecutar unit tests.

## Evidencias
Tabla por UAT-ID: canal, rol, plantel ficticio, pasos, esperado/obtenido, SHA, fecha, estado (aprobado/falló/bloqueado/pendiente) y evidencia no sensible. No escribir «aprobado» en JSON institucional sin evidencia y autorización.
