# Catálogos académicos — #97, base de #96

Decisión del solicitante: catálogos configurables sin valores oficiales inventados.
No hay seeds, traducción automática de grado ni reclasificación de expedientes.

- Nivel pertenece a un plantel y su clave es única en ese plantel.
- Carrera/plan pertenece a un nivel del mismo plantel; clave y versión identifican
  el plan. El plan no redefine créditos: se conserva Materia.creditos. La relación
  curricular detallada depende del catálogo institucional y del futuro #101.
- Periodo pertenece a carrera/plan y ciclo: ANUAL, SEMESTRAL o CUATRIMESTRAL y número
  positivo (límite técnico 1000). No es un periodo de evaluación P1/P2/P3/Final.
- Grupo recibe nivelId, carreraId y periodoAcademicoId opcionales como conjunto.
  Todo contexto configurado debe estar activo y ser compatible con plantel/ciclo.
  Un grupo con inscripciones históricas no puede cambiar ese conjunto. La promoción
  requiere nivel y carrera/plan compatibles; no copia ni modifica notas.

ADMINISTRATIVO gestiona dentro de su plantel; SUPERADMIN global. FINANZAS y MAESTRO
solo consultan catálogos dentro de su alcance, sin permisos nuevos de escritura.
La API aplica ScopeService. Los formularios dependientes limpian solo dependencias
inválidas al cambiar padre, conservando nombre, clave y datos restantes.

## Contrato

`/academico/catalogos/{niveles|carreras|periodos}`: GET paginado (10 por defecto,
máximo 100), POST y GET/PATCH `/:id`. Busca clave/nombre; filtros por plantel,
nivel para carreras, carrera/ciclo para periodos. `inactivos=true` incluye historial.
Plantel, nivel, versión de plan, carrera y ciclo son inmutables en sus catálogos;
se pueden editar clave/nombre y activar/desactivar sin borrado. Un catálogo usado
por grupos activos o con descendientes activos no se desactiva. Cambios auditados.
Grupos admite filtros nivelId/carreraId/periodoAcademicoId, además de los existentes.

## Migración y compatibilidad

Aplicar `migracion_catalogos_academicos.sql` por el runner incremental, DB_SYNC=false,
con respaldos previos. Hay espejo MySQL/SQL Server, FKs, claves únicas, CHECK de
contexto completo e índice. No se ejecuta schema.sql sobre una base existente.
Los grupos históricos conservan las tres columnas NULL, todas las identidades,
inscripciones, cargos y notas. Crear grupos sin contexto sigue disponible para
compatibilidad; no se usan como evidencia de una carrera/plan aprobada.

Reversión de aplicación: restaurar binarios previos conservando tablas/columnas y
sus datos; no borrar catálogos ni retirar columnas. Validar staging con ambos
motores antes de habilitar operación institucional. La integración no es despliegue.

## Verificación

Pruebas de contexto completo/parcial/inactivo y mezcla plantel/nivel/carrera/ciclo;
HTTP en ambos motores para permisos, duplicados concurrentes, dependencias,
filtrado de grupos, paginación y conservación de grupos previos; pruebas web de
carga diferida, selectores dependientes, conservación ante fallo y reintento.
