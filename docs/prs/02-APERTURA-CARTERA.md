# Apertura de cartera — contrato de integración

## Estado real
`web/src/App.tsx` no registra actualmente una ruta independiente de apertura de cartera. Existen `Alumno`, `Inscripcion`, `Cargo`, `ConceptoPago` y operaciones financieras, pero no una transacción de apertura que las coordine. No se agregan rutas falsas en este PR.

## Archivos a intervenir en la implementación
- `backend/src/alumnos/`, `backend/src/academico/` y `backend/src/finanzas/`: orquestación en **backend** y validación de permisos por plantel.
- `backend/src/entities/` y `database/mysql/`, `database/sqlserver/`: solo si los catálogos y estados del flujo requieren nuevos campos; migraciones espejo y compatibilidad histórica.
- `web/src/App.tsx`, `web/src/layout/Shell.tsx`, `web/src/pages/Alumnos.tsx`: entrada **visible** “Apertura de cartera” para Control Escolar/Finanzas según matriz autorizada; vista enfocada, nunca en Expo.
- Pruebas unitarias y `backend/test/integration/`: reintento, rollback y alcance por rol.

## Recorrido objetivo
1. Seleccionar alumno existente o terminar alta según permisos.
2. Plantel → nivel → carrera/plan → ciclo → periodo → turno → modalidad.
3. Elegir grupo regular compatible o solicitar planificación automática **solo** para modalidad ordinaria.
4. Previsualizar inscripción/conceptos/precios provenientes de FINANZAS, **sin** confiar en montos del cliente.
5. Confirmar una única vez con clave de idempotencia y bitácora. Si hay error, no dejar ni grupo ni cargo huérfano.
6. Si la cohorte regular tiene 1–4 alumnos sin grupo compatible, registrar condición pendiente sin habilitar grupo irregular.

## Exclusiones
Ni recursamiento ni programas especiales abren cartera ordinaria. Preservar datos históricos, activación segura y recibos. No inventar catálogo de precios.

## Bloqueos institucionales
Catálogo nivel/carrera/periodo, política de grupos 54→55, tarifas/fechas y matriz exacta de responsables. Depende de #97 y del cierre funcional de #99.

## Aceptación
Alta simple, doble clic, dos administradores concurrentes, alumnos de planteles distintos, fallos de cargo, transferencia y rollback probados en MySQL y SQL Server; UI con carga/vacío/error/éxito.
