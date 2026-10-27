# Deuda técnica · candidata 1.27.58

Base de trabajo: main 1.27.57, `db55865`. Fecha: 27/oct/2026. Rama: `fix/deuda-tecnica-tipos-hooks`.

## Problema y resultado

El barrido local detectó 623 advertencias de lint en backend (620 tipos `any` explícitos en pruebas y tres imports sin uso), ocho advertencias de hooks en web y peticiones HTTP reales desde pruebas unitarias que terminaban aprobadas con errores de red jsdom.

- Los dobles de pruebas declaran repositorios, servicios, DTO, entidades y contextos Nest concretos. `backend/src/test-utils/stub.ts` concentra la construcción de dependencias parciales: valida nombres y valores de miembros, permite dobles anidados y spies de Jest y devuelve el tipo de la dependencia. Sus miembros omitidos no existen en ejecución; una prueba sigue debiendo definir todos los que utiliza. Los mocks Jest conservan sus propias firmas, por lo que esto no equivale a verificar íntegramente cada contrato del ORM.
- Se eliminó la excepción que permitía `any` explícito en archivos `.spec.ts` y se retiraron los tres imports sin uso. Backend y web exigen cero advertencias mediante `--max-warnings=0`.
- Los efectos de consulta en ContextosMateria, PanelSeguimientoPagos, Alumnos, Finanzas, Materias, Planteles y Usuarios emplean callbacks estables de invalidación. Conservan los contadores que descartan respuestas tardías. Finanzas evita una segunda invalidación redundante al desmontar.
- MarcaProvider aplica la identidad visual en un efecto dependiente de la marca, separado del efecto estable de revalidación y suscripciones. Sus pruebas verifican título/colores y que cambiar la marca no genere consultas adicionales.
- `web/test/setup.ts`, cargado por Vitest, reemplaza el adaptador Axios predeterminado con uno que rechaza y registra peticiones sin simular. Al terminar cada prueba, una petición no declarada provoca un fallo. No se silencian errores de consola ni se devuelve una respuesta ficticia global exitosa.
- Las pruebas de Configuración simulan explícitamente `GET /configuracion/bbva`; las de Cuenta, `GET /auth/me`. El aislamiento estricto identificó 14 pruebas afectadas antes de corregirlas. El setup forma parte de TypeScript y lint.

## Verificación local

- Backend: `npm run lint`, `npm run typecheck`, `npm test -- --runInBand` (90 suites / 487 pruebas) y `npm run build` aprobados, cero advertencias de lint.
- Web: `npm run lint`, `npm test` (62 archivos / 232 pruebas) y build con `VITE_API_URL=https://api.example.invalid/api` aprobados. Cero advertencias de lint y sin los AggregateError de red jsdom previos. La URL de build es ficticia: solo valida compilación, no conectividad de un despliegue.
- Móvil: 25 archivos / 128 pruebas Vitest, 11 controles Node y `tsc --noEmit` aprobados.
- Consistencia de versiones, baseline/migraciones espejo, enlaces README y 316 consultas cliente frente a 311 rutas API aprobada. Skills válidas; matrices beta/UAT estructuralmente válidas y pendientes conservados. `git diff --check` aprobado.
- Antes de corregir los mocks, el nuevo guard hizo fallar 14 pruebas por peticiones no simuladas. Esto comprobó que los errores no quedan ocultos aunque la aplicación capture el rechazo HTTP.

No se ejecutaron integración con MySQL/SQL Server, E2E de navegador, Windows/IIS, proveedores externos ni pruebas físicas. Las suites locales no sustituyen esas validaciones ni UAT.

## Alcance operativo

Sin cambios de esquema, migraciones ni reglas académicas/financieras. No se contactaron servicios institucionales ni se emitieron correos, cobros o despliegues. Las ocho puertas beta y los 46 escenarios UAT conservan su estado pendiente. La base remota se comprobó al preparar el PR; CI del SHA final queda pendiente; el número candidato debe ajustarse si cambia la base.

Este cierre corresponde a los avisos y al aislamiento HTTP detectados; no afirma haber eliminado toda posible deuda técnica del producto.
