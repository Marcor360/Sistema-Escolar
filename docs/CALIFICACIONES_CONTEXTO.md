# Contexto de evaluación — entrega parcial de #102

> Actualización 28/oct/2026: este documento conserva el diseño/corte histórico. La institución confirmó reglas nuevas y la candidata 1.28.0 las implementa según [contrato vigente](EVALUACIONES_1.28.0.md). Asistencias ya implementadas desde 1.27.53. No usar los antiguos bloqueos de aprobación general como estado actual; el redondeo y formatos oficiales siguen pendientes.

El selector de clases devuelve, dentro del alcance vigente de plantel/clases propias, las relaciones opcionales de nivel, carrera/plan y periodo del grupo. Los LEFT JOIN conservan las clases históricas que no tienen contexto configurado.

La pantalla de calificaciones muestra ID de clase, clave/asignatura, grupo, plantel, ciclo, nivel, carrera, versión del plan, periodo y turno. Cuando falta un dato histórico se indica que no está registrado; no se reclasifica ni se inventa información.

El solicitante confirmó que la nueva norma no está definida. Esta entrega conserva P1–P3, Final independiente, escala 0–100, correcciones justificadas, cierre/reapertura e importación actuales. No añade cuarta evaluación, faltas, redondeos, promedio especial ni un acta con formato no aprobado. Esos puntos mantienen abierta #102.

No requiere esquema nuevo ni modifica permisos. Integración por ambos motores: contexto completo y NULL heredado, acceso de ADMINISTRATIVO por plantel, MAESTRO por clases propias y denegación a Finanzas/alumno. Las pruebas de captura idéntica y auditoría continúan aplicando.
