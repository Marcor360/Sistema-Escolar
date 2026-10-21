# Implementación de evaluaciones académicas — contrato de transición 1.28.0

**Estado:** especificación de implementación para revisión. Sin cambios de comportamiento, schema ni escala en producción.

## Evidencia del estado actual (base revisada)

- `backend/src/entities/calificacion.entity.ts`: `parcial` admite conceptualmente 1–3 y reserva 0 para Final; `calificacion` es decimal no nulo y no representa NP.
- `backend/src/calificaciones/calificaciones.dto.ts`: captura 0–100, hasta 2 decimales, `parcial` de 0 a 3.
- `backend/src/calificaciones/calificaciones.service.ts`: captura transaccional, auditoría y cierres; una modificación existente exige motivo, pero no separa por sí sola corrección definitiva de edición provisional.
- `backend/src/calificaciones/calificaciones.controller.ts`: `POST /calificaciones/captura` acepta MAESTRO/ADMINISTRATIVO; gestión de periodo para ADMINISTRATIVO. Comprobar cómo se resuelve SUPERADMIN mediante jerarquía de roles antes de modificar guards.
- `web/src/pages/Calificaciones.tsx`: selector 1–3 y Final (0), escala 0–100.
- `mobile/src/screens/Calificaciones.tsx`: interfaz de alumno ya existente; evaluar contrato de lectura antes de modificarla.
- `docs/PLAN_CALIFICACIONES_ACTAS_1.28.0.md`: advertencias previas sobre escala, aprobación y datos históricos.

## Reglas solicitadas para el modelo nuevo

- Cuatro parciales mensuales, notas 0–10, aprobatoria 6. Vigencia normativa nueva, **sin recalcular registros históricos**.
- NP es estado distinto de una nota numérica; no convertirlo a cero.
- Criterios por asignatura/docente/parcial, suma exactamente 100%, cálculo en API con nota original decimal y definitiva diferenciadas.
- Asistencia, falta, retardo y falta justificada: exclusivamente seguimiento informativo; no modifican nota, aprobación ni derecho a examen.
- Docente: captura asignaciones propias durante periodo abierto, nunca corrección definitiva cerrada por vía ordinaria.
- Administrativo autorizado: corrección definitiva dentro de ámbito institucional y motivo obligatorio. Super Admin: corrección y autorizaciones extraordinarias.
- Tercera semana: fecha de bloqueo configurable **sin valor predeterminado que cierre capturas** hasta confirmar definición exacta.
- Redondeo: **no activarlo** hasta aprobación de fórmula completa. Los ejemplos 7.5→6 y 7.6→8 son insuficientes para inferirla.
- Alumno: solo notas propias publicadas, NP, estado de evaluación y asistencias; sin mostrar borradores ni pantallas de gestión en Expo.

## Plan de implementación en PR separados

### PR funcional A — persistencia retrocompatible
1. Definir versión de regla académica asociada a ciclo/programa o instancia de evaluación, evitando migrar implícitamente 0–100 a 0–10.
2. Mantener `parcial=0` como Final legado; añadir P4 sin colisionar con registros existentes.
3. Introducir estado NP explícito, nota decimal original y definitiva, y estado de publicación.
4. Preparar migraciones espejo MySQL y SQL Server **aditivas** y actualizar manifiesto, entidades y pruebas de lectura histórica.
5. Documentar el comportamiento de notas históricas 0–100 y parcial Final independiente; exigir conciliación antes de cualquier conversión o recálculo.

### PR funcional B — motor de criterios y cálculo
Configurar pesos por docente/asignatura/parcial; bloquear cierre de configuración cuando pesos ≠100%; cálculo estable y auditable en NestJS; no activar redondeo indefinido.

### PR funcional C — asistencia informativa
Registrar los cuatro estados, con unicidad por alumno/clase/fecha cuando aplique, filtros y reportes. Asegurar que ninguna consulta de asistencia participe en el cálculo de calificación.

### PR funcional D — ventanas y autorizaciones
Fechas y zona horaria institucional configurables por evaluación; bloqueos en API y UI; concesiones extraordinarias con docente, clase, parcial, motivo, otorgante y vencimiento; cierre automático por fecha aun sin tareas programadas.

### PR funcional E — correcciones, publicación y auditoría
Comandos independientes para captura ordinaria y corrección definitiva; autorizaciones por scope en backend; transacciones y control de concurrencia; bitácora append-only; invalidación de caché tras publicación/corrección.

### PR funcional F — pantallas y aceptación
Web docente/administrativo y Expo solo alumno; carga, vacío, error, éxito, accesibilidad y paginación; pruebas de API, seguridad, UAT y documentación.

## Matriz mínima antes de liberar

| Prueba | Resultado requerido |
| --- | --- |
| Históricos P1–P3, Final=0 y escala 0–100 | Lectura idéntica; ningún recálculo |
| Nueva nota inferior a 0 o superior a 10 | Rechazo para reglas nuevas |
| NP | Estado independiente sin nota numérica |
| 4 parciales | P4 no colisiona con Final=0 |
| Ponderaciones ≠100% | No finalizar configuración |
| Docente ajeno / alumno ajeno | 403 o conjunto vacío conforme contrato, sin fuga |
| Cambio definitivo sin autorización | Denegado incluso llamando directamente a API |
| Corrección autorizada | Motivo y auditoría íntegra |
| Captura fuera de plazo | Denegada excepto permiso extraordinario válido |
| Faltas | Cero impacto en cálculo y elegibilidad |
| Nota provisional | Invisible como definitiva para alumno |
| MySQL y SQL Server | Migraciones equivalentes y reversibilidad operativa documentada |

## Decisiones bloqueantes, sin supuestos automáticos

1. Vigencia/aplicabilidad de la nueva escala a programas, niveles, ciclos y grupos ya iniciados.
2. Conversión o coexistencia histórica de 0–100 y 0–10; mantener históricos intactos por defecto.
3. Regla institucional completa de redondeo, incluido comportamiento alrededor de 6.
4. Definición exacta del inicio de la tercera semana y zona horaria de cierre.
5. Forma de calcular/publicar resultado global de los cuatro parciales; no asumir promedio simple.
6. Protocolo de publicación y corrección de actas oficiales.

**Control de liberación:** no desplegar ni fusionar cambios académicos mayores sin pruebas en ambos motores, autorización institucional y UAT. Este PR es solo preparatorio y **no constituye implementación funcional de 1.28.0**.
