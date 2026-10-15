# Barrido responsivo y funcional — 15 de octubre de 2026

Corte: 1.24.0-beta.2, posterior a #58. Se revisó la presentación web con Chromium y API simulada, complementada por pruebas unitarias y CI integral con API y bases reales. La simulación permite reproducir textos y datos largos; no acredita una operación institucional ni reemplaza QA nativa.

## Problemas corregidos

- Con texto al 200 % en 375 px, los controles de paginación de Conducta desbordaban el documento. Ahora ajustan las filas sin perder botones ni indicador de página.
- En el mismo tamaño, los campos del catálogo financiero podían alcanzar 451 px. Las etiquetas y sus controles ajustan su ancho; las casillas conservan su presentación.
- Quince tablas de Finanzas, Conciliación, Cobranza, Conceptos, Bitácora, Calendario, Conducta, clases de docentes, administración de grupos e historial de calificaciones disponen de regiones nombradas y enfocables. Su desplazamiento queda dentro de la tabla, manteniendo las columnas y acciones disponibles.
- Los diálogos de confirmación y motivo limitan su ancho y alto al viewport, permiten desplazamiento vertical y ajustan campos y botones. Esto evita recortes en pantallas bajas y orientación horizontal.
- Botones y textos de contenido ajustan cadenas largas. No se oculta globalmente el desbordamiento de la página para disimular errores.

## Verificación reproducible

Ejecutar desde `web`: `npm run test:responsive`, con Chromium instalado por Playwright. Para usar un Chromium disponible en el sistema: `CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:responsive`. `RESPONSIVE_EXTENDED_ONLY=1` limita la ejecución a los escenarios añadidos; CI ejecuta la suite completa.

La suite existente comprueba navegación, foco y cierre del menú, formularios, acciones de tablas, indicadores, listados y estados de carga desde 320 hasta 3840 px. Se amplía con:

| Pantallas | Matriz añadida |
|---|---|
| Cuenta, Configuración, Conducta, Calendario, Avisos, Finanzas y retorno de pago | 320×568, 375×667 con texto al 200 %, 568×320, 768×1024, 1024×768 y 1440×900 con texto al 200 % |
| Finanzas: Cargos, Pagos y Adeudos | Registros completos, nombres y referencias largas, estados de pestañas y desplazamiento de regiones por teclado |
| Seguimiento de cobranza | Error extenso y apertura/cierre del diálogo con Escape en toda la matriz |
| Recuperación de contraseña | 320×568, 568×320 y 1440×900; solicitud de código y formulario de restablecimiento |

Se comprueba que el documento no desborde horizontalmente, que los diálogos quepan y que no aparezcan errores JavaScript. Las pruebas unitarias conservan las reglas de formularios y operaciones. TypeScript móvil verifica contratos; no mide geometría nativa.

## Límites y aceptación pendiente

La clasificación sigue siendo **beta avanzada con presentación web verificada en la matriz automatizada**. Esto no significa que todos los flujos y todos los dispositivos estén certificados. Faltan Safari/iOS y Firefox, dispositivos Android/iOS con teclado real, TalkBack/VoiceOver, seis pestañas nativas a 320 px con fuentes ampliadas, y aceptación por cada rol con datos de la institución. SMTP, Openpay, antivirus, restauración y despliegue mantienen sus requisitos de aceptación independientes.

Una ventana Chromium estrecha representa la web móvil; no sustituye una ejecución de React Native en un teléfono. No se alteran permisos, pagos, esquema ni bases existentes como parte de este barrido.
