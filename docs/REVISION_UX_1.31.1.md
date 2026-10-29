# Recorrido UX/UI — candidata 1.31.1

Fecha: 29/oct/2026. Base Git: `69f86a8c80f08cdc4006deb8053e79fa453b9fee`, con cambios locales de cartera integral 1.31.0 conservados. Esta revisión corresponde al código local; no acredita CI de un commit nuevo, despliegue, UAT ni pruebas en dispositivos físicos.

## Skills y alcance

Aplicadas: `.agents/skills/iua-arquitectura-contexto/SKILL.md`, `iua-auditoria-ux-accesibilidad/SKILL.md`, `iua-recorridos-uat/SKILL.md` e `iua-auditoria-seguridad/SKILL.md`.

Inspección con Chromium y API simulada: Apertura de cartera, Usuarios, Alumnos, Finanzas y Grupos a 360, 768, 1280 y 1920 px. Revisados componentes compartidos, formulario poblado, estados vacíos, búsqueda sin conexión, cambio de filtros, foco de teclado y menús por rol. Todos los datos utilizados son ficticios. Seguridad en este recorrido: revisión estática de la separación UI/API y de permisos visibles; no se repitió una auditoría completa del servidor ni se contactaron sistemas institucionales.

## Hallazgos corregidos

| Prioridad | Hallazgo y reproducción | Corrección y ubicación |
| --- | --- | --- |
| Alta | `/usuarios?vista=consulta`, 360 px: la regla de escritorio mantenía la tabla a 1060 px. Las etiquetas se veían, pero los valores quedaban fuera del área visible. Una prueba de desbordamiento del documento no detectaba el problema. | `web/src/styles/organizacion-modulos.css`: prevalece la presentación móvil de `.tabla-adaptable` sobre los anchos de escritorio. La prueba mide también el rectángulo del texto de una celda. |
| Media | `/apertura-cartera/nueva`: etiquetas y campos en línea, datos personales en una columna excesivamente larga y cuotas sin una rejilla coherente. | `AperturaIntegral`: cada etiqueta/control permanece en `.campo`; identidad en dos columnas, selectores agrupados y cuotas en cuatro/dos/una columnas según espacio. En la captura de 1280 px, la página pasó de 2871 a 2234 px de alto, aproximadamente 22 % menos recorrido vertical. |
| Media | Cada `SelectorBuscable` mostraba Anterior/Siguiente incluso con un solo resultado. Cambiar de plantel podía conservar una página posterior. | Paginación solo si hay más de diez resultados; nombres accesibles por selector; reinicio a página 1 al cambiar ruta/filtros. Se conserva la consulta y el reintento tras fallar la red. |
| Media | Asignación de correo con controles y acciones pegados, sin mover el foco al panel abierto. | `UsuariosPage`: rejilla de datos, acciones separadas, foco en el título al abrir y devolución al botón de origen al cancelar. |
| Media | Resumen financiero compuesto por párrafos extensos, con importes difíciles de comparar. | `ResumenCartera`: pagos aplicados y saldo separados, cuotas desplegables y filas de cargos con importes alineados. No cambian cálculos ni pagos. |
| Baja | Las tarjetas de operaciones no compartían una distribución consistente y las guías de Control Escolar no explicaban la nueva alta sin correo. | `PanelAccionesModulo`: tarjetas alineadas y texto secundario legible. `recorrido-por-rol.ts`: pasos específicos de cartera y correo posterior, filtrados por permisos. |

## Evidencia local

- 20 combinaciones de vista/ancho: sin desbordamiento del documento, sin errores JavaScript y sin infracciones reportadas por axe-core para las reglas WCAG 2 A/AA y 2.1 AA ejecutadas. Esto no equivale a certificar accesibilidad completa.
- Menú móvil comprobado como ADMINISTRATIVO, FINANZAS y MAESTRO: Apertura de cartera se anuncia únicamente al rol autorizado; SUPERADMIN se utilizó en el recorrido general.
- `test:cartera`: creación sin correo, cuotas, pausa, asignación posterior de correo y consulta del historial a 360/768/1280/1920 px; etiquetas encima del control, texto de celda visible, cancelación con Escape y foco restaurado. Comprobación adicional de ampliación CSS al 200 %, distinta de una certificación de zoom nativo o lector de pantalla.
- `test:responsive`: regresión general con API simulada, incluida recuperación, activación, formularios, tablas y recorridos por módulos.
- Lint y compilación web aprobados; 68 archivos / 257 pruebas web aprobadas; las pruebas de selector y guía comprueban filtrado/paginación y que no se anuncien rutas fuera de rol.
- Sin cambios nuevos de API, esquema o reglas financieras respecto de 1.31.0. No se aplican nuevas migraciones por estos ajustes visuales; sigue siendo necesaria la migración de cartera integral antes de desplegar el conjunto.

## Siguientes funciones recomendadas, todavía no implementadas

1. **Pendientes de inscripción por plantel.** Ampliar Seguimiento con alumnos sin correo, activaciones pendientes y carteras en pausa, con enlaces directos al expediente. Actualmente `SeguimientoService.pendientes` cubre otros pendientes y no reúne esos estados.
2. **Reprogramación de carteras en pausa.** Permitir revisar el calendario antes de reanudar cuando cambian las fechas de incorporación. Requiere definir quién autoriza y conservar pagos, cargos e historial; no modificar cuotas ya pagadas de manera implícita.
3. **Ficha unificada del alumno.** Reunir información académica, cartera/pagos y estado de acceso en una vista, reutilizando las consultas existentes y sus permisos. Evitaría saltos entre Alumnos, Apertura, Finanzas y Usuarios.

Pendiente externo: UAT con operadores, lector de pantalla, navegadores/dispositivos institucionales y revisión de datos reales autorizada. Las aceptaciones institucionales permanecen pendientes.
