# Diseño incremental: roles múltiples, DIRECTOR y titulación SEP

## Estado
Esta entrega introduce únicamente el tipo DIRECTOR, su catálogo mediante migración y la política pura de jerarquía con pruebas. **No abre rutas de DIRECTOR, no permite promoción de ALUMNO, no firma ni envía títulos**. Integrar la política en operaciones de usuarios requiere un PR adicional con autorización por plantel, expedientes docentes y auditoría.

## Política de asignaciones
- SUPERADMIN es autoridad técnica. No puede eliminarse la última cuenta activa; las cuentas SUPERADMIN requieren un flujo protegido.
- DIRECTOR administra personal inferior en su ámbito autorizado, no SUPERADMIN.
- ADMINISTRATIVO puede asignar o quitar MAESTRO y FINANZAS a personal subordinado, no ADMINISTRATIVO/DIRECTOR/SUPERADMIN.
- MAESTRO y FINANZAS no conceden por sí solos gestión de otros usuarios.
- Las capacidades se suman por operación, no se heredan por rango. MAESTRO requiere expediente docente y asignaciones reales; no basta un rol nominal.
- Para cambiar roles: comprobar roles vigentes del actor desde BD, roles vigentes del destino bajo bloqueo, ámbito de ambos, existencia de expediente, evitar cambios propios, auditar antes/después y revocar sesiones.
- ALUMNO sigue siendo excluyente. Si una persona estudia y trabaja se requieren identidades de acceso separadas vinculadas a su identidad institucional, sin duplicar su expediente académico.

## Titulación electrónica (propuesta; **no implementada**)
1. Expediente basado en egreso existente, revisión de programa/RVOE, requisitos y versiones.
2. Firmantes y certificados con vigencia e historial, referencias a almacenamiento cifrado y autorización explícita.
3. XML conforme al esquema SEP y validación XSD con pruebas oficiales; sin supuestos sobre endpoints.
4. Flujo BORRADOR → VALIDADO → AUTORIZADO → FIRMADO → ENVIADO → ACEPTADO/RECHAZADO, con acuses inmutables e idempotencia.
5. El RVOE aún no se conoce. No habilitar firma automática ni envío de producción hasta validar institución, funcionarios y procedimiento SEP.
6. DIRECTOR podrá gestionar titulación desde web únicamente; SUPERADMIN administra infraestructura sin asumir identidad criptográfica del rector. Expo continúa exclusivo para ALUMNO.

## Próximos PR separables
- Autorizar operaciones de gestión de roles por actor y plantel en servicio, controller, UI y pruebas de integración; preservar CRUD actual.
- Alta/vinculación de identidades laborales para alumnos con matrícula existente.
- Módulo de expedientes y configuración de firmantes, con migraciones espejo.
- XML y validación XSD oficial.
- Integración de firma autorizada y adaptador SEP tras confirmar RVOE y accesos oficiales.

## Verificación
Ejecutar backend lint/typecheck/test/build y pruebas SQL aisladas; no se han ejecutado como parte de esta especificación.