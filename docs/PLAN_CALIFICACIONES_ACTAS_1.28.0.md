# Contrato condicionado de calificaciones y actas — versión objetivo 1.28.0

**Estado:** propuesta de especificación, sin reglamento institucional aprobado. **No liberar ni activar cambios funcionales.** El issue #139 mantiene pendientes fórmula, escala, periodos, asistencias, cierres, firmas y actas. Esta entrega documental se versiona como 1.27.12. La versión objetivo 1.28.0 corresponde a una implementación futura aprobada; no representa una norma vigente.

El [anexo técnico de transición](IMPLEMENTACION_EVALUACIONES_1.28.0.md), incorporado en la entrega documental 1.27.20, desarrolla una propuesta de cuatro parciales, NP y asistencia informativa. Sigue pendiente de aprobación institucional; no sustituye la escala 0–100, P1–P3 ni Final vigentes.

## Formatos recibidos y alcance técnico actual

Se recibieron los PDF de acta y boleta. La entrega 1.27.9 ofrece formatos informativos y descargas privadas, conservando 0–100 y el promedio vigente P1–P3. El ejemplo usa 0–10, pero falta aprobar equivalencia o cambio de escala. Asistencia, evaluación continua, examen desglosado, seriación, firmas y ponderaciones continúan pendientes; no se infieren del diseño. Ver [formatos escolares](FORMATOS_ESCOLARES.md).

## Qué existe
- Escala 0–100, P1/P2/P3 y Final independiente en las rutas actuales.
- Captura, historial de correcciones motivadas, cierre/reapertura e importación con permisos por docente/plantel.
- Consulta de alumno con aislamiento de expediente; no calcular notas en clientes.

## Decisiones obligatorias por escrito
1. Reglamento vigente por nivel, modalidad, programa y plantel, vigencia y autoridad firmante.
2. Escala, número de evaluaciones, fórmula y pesos aprobados, redondeo, no presentado y equivalencias.
3. Definición de asistencia: fuentes, justificantes, exclusiones y efecto (o ausencia de efecto) en nota final.
4. Cierre definitivo, periodo de corrección, recurso de revisión y usuarios facultados para reabrir.
5. Lista, boleta y acta: campos oficiales, folios, firmas, firmas electrónicas o manuscritas, sellos, fecha y versión institucional.
6. Privacidad y conservación de documentos académicos de menores y expediente digital.

## Diseñar después de aprobación
- Modelo/versiones normativas asociadas a evaluación, sin conversión retroactiva de notas existentes.
- Motor transaccional de cálculo en NestJS, DTOs estrictos, entidades/migraciones espejo y validaciones por plantel.
- Vista web por rol MAESTRO/ADMINISTRATIVO para previsualizar, corregir, aprobar y emitir actas oficiales bajo permisos; acceso ALUMNO solo a notas y PDFs propios desde Expo.
- Generación de PDF privada con firma/folio verificable y bitácora de emisión/cancelación/reemisión. Nunca servir actas con ruta estática abierta.
- Vista previa contra datos históricos sin alterar registros previos; procesos de conciliación con aprobaciones.

## Matriz de aceptación requerida
| Escenario | Resultado esperado |
| --- | --- |
| Docente de otra clase | 403 y cero filas ajenas |
| Alumno de otro plantel | Aislamiento de notas y documentos |
| Recalcular nota cerrada | Denegado salvo autorización normativa |
| Corrección concurrente | Conflicto, motivo y bitácora íntegra |
| Acta firmada | Folio, plantilla aprobada y trazabilidad |
| PDF reenviado | Sesión y permisos en cada descarga |
| Cierre y reemisión | Historial inmutable, sin borrar acta previa |
| Importación masiva | Previsualizar y confirmar sin pérdida parcial |
| MySQL/SQL Server | Paridad de migraciones, tipos y resultados |
| Mobile alumno | Solo lectura de notas y actas propias |

## Entregables para convertir este draft en un PR implementable
- Reglamentos firmados/aprobados y plantillas oficiales versionadas.
- Matriz definitiva de roles y límites, incluido tutor de menores si aplica.
- Fixtures anónimos y resultados de UAT, CI y restauración.
- Rebasar contra la última versión aprobada; incrementar a 1.28.0 **solo cuando el alcance funcional y el código estén implementados**, con versiones de workspaces/lockfiles/Expo y matrices de aceptación alineadas.

Riesgo alto: emitir actas no oficiales o recalcular históricos. Prohibido aplicar migraciones destructivas o un cambio de escala sin aprobación.
