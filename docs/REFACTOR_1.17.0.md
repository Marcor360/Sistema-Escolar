# Refactor controlado 1.17.0

8 de octubre de 2026. Continúa la corrección de seguridad 1.16.1; endpoints, DTOs y esquema se mantienen. Sin migración nueva.

AcademicoService es una fachada de 3 KB. CiclosService mantiene ciclos/transiciones; MateriasService administra catálogo; GruposService administra grupos/asignaciones y acceso; InscripcionesService administra altas/bajas y bitácora. Helpers de conflictos de motor compartidos. Las pruebas existentes usan los providers extraídos sin quitar casos.

La suite HTTP conserva un único bootstrap/baseline por motor. Sus 47 casos se registran desde once archivos en `backend/test/integration/` mediante un contexto con getters/setters, preservando el orden de las regresiones y sus datos compartidos. El launcher pasa de más de 100 KB a aproximadamente 22 KB. Los dos recorridos Chromium continúan usando API/DB reales.

FinanzasPage coordina estado, idempotencia, carga y operaciones. PanelCargos, PanelPagos y PanelAdeudos mantienen campos, etiquetas, tablas, selección paginada y callbacks; tipos compartidos fuera de la página. Catálogo, conciliación y cobranza ya eran componentes independientes.

`ConfigModule` valida entorno antes de construir providers. NODE_ENV, motor, conexión, secreto, uploads y DB_SYNC=false son explícitos. Verifica puertos, booleanos, URLs, pares de credenciales, CORS y requisitos de proveedores según modo. Producción y staging exigen TLS y CORS HTTPS; producción exige secreto de 32 caracteres. Staging conserva proveedores opcionales. Openpay mantiene sus validaciones de URL/proveedor de producción. No se imprimen valores de credenciales en errores. TypeORM ya no toma root/contraseña vacía/base escolar por defecto.

Validación: backend lint/typecheck/build y 166 unitarias; web lint/test/build; integración 47 casos SQL Server y 49 casos MySQL con Chromium. La publicación debe confirmar ocho jobs verdes para su SHA exacto. El refactor no certifica infraestructura ni piloto.
