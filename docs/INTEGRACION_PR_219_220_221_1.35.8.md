# Integración de PR #219, #220 y #221 · 1.35.8

Los PR originales se fusionaron en ramas de desarrollo y no en main. Se recuperan entidades, servicios, DTO, tests y migraciones sobre 1.35.7 sin restaurar versiones antiguas de formularios o usuarios.

## Migraciones y orden
Requiere rol DIRECTOR e historial de roles existentes. El manifiesto incorpora al final (en MySQL y SQL Server) `migracion_titulacion_expedientes.sql`, `migracion_titulacion_firmantes.sql` y `migracion_usuario_vinculos_persona.sql`. Aplicar tras respaldar base y ensayar restauración en ambiente aislado. Nunca usar `DB_SYNC=true` en staging.

## Aislamiento
Titulación: únicamente DIRECTOR por WEB, validación de plantel y expediente EGRESADO. Solo BORRADOR; RVOE sin determinar. Firmantes: solo registro pendiente de validación, sin firma, claves privadas ni envío a SEP. Vinculación: alumno conserva identidad y expediente; identidad laboral independiente, rol FINANZAS o ADMINISTRATIVO, actor autorizado, motivo y aprobación expresa. Se preserva segundo nombre.

## Checklist de aceptación pendiente
CI del SHA final: backend lint, typecheck, tests y build; web y móvil; MySQL y SQL Server; scripts y E2E. UAT de roles/planteles y competencia de migraciones (incluida concurrencia de duplicados); homologación legal/SEP antes de cualquier emisión. El commit no acredita despliegue.
