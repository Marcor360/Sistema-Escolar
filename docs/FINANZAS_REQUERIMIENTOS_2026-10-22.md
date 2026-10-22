# Finanzas: alcance de los siete requerimientos (22/oct/2026)

Base auditada: `main` 1.27.20; API NestJS, portal React/Vite, Expo exclusivo de ALUMNO.

## Estado y dependencias

| Petición | Situación revisada | Implementación |
| --- | --- | --- |
| Cartera vencida, mensajes el día 3 | CobranzaService ya registra envíos por destinatario y despacha en cola; el disparador mensual no existe | Programación mensual con zona horaria de México, activación explícita y deduplicación persistente; no enviar sin SMTP/UAT |
| Cuentas por pagar | No se encontró dominio persistido de obligaciones a proveedores | Diseñar entidad/proveedor, importe, fecha, estado, responsable, anticipación, permisos y notificaciones antes del código |
| Reporte de bajas | Baja existe como estatus; no hay fecha histórica certificada del evento | PR 1.27.21 exporta **bajas actuales** XLSX en el scope; no afirmar que updatedAt sea fecha de baja |
| Gráfica al iniciar | Dashboard muestra `cobradoMes` y `saldoPendiente` como tarjetas, sin serie gráfica | Crear serie mensual de pagos confirmados por origen/plantel y gráfica accesible |
| Conceptos a cualquier alumno | FINANZAS ya puede crear cargos individuales mediante POST /finanzas/cargos; se validan alumno, concepto, monto y plantel | Mejorar descubrimiento por matrícula y catálogo; nunca permitir saltar scope o cargar tipos BECA/DESCUENTO/RECARGO como nuevos cargos |
| Estado de cuenta descargable | JSON ya existe para alumno y FINANZAS; faltaba exportar | PR 1.27.21 expone PDF protegido y descarga web; pagos no aplicados/anulados no disminuyen saldo |
| Interés automático 10% desde día 4 | Recargo 10% manual existe; solo conceptos con aplicaRecargo=true y cargos ya vencidos, sin doble cargo | Antes de automatizar, aprobar fecha de vencimiento: generación masiva actual usa día 5 por defecto; definir base del 10%, meses exentos, ajustes y si aplica a parcialidades |

## Decisiones operativas que requieren aprobación

1. **Día 3:** definir si se comunica a todos los que aún adeudan o solo a quienes ya vencieron; evitar la etiqueta «cartera vencida» si todavía no vencieron. Recomendada: recordatorio preventivo según fecha de vencimiento.
2. **Día 4:** mantener bloqueada toda ejecución automática mientras el vencimiento vigente sea el día 5. Aprobación expresa del cambio de fecha, la base gravable del 10% y manejo de pagos parciales/fin de semana.
3. **Cuentas por pagar:** definir responsables, calendario por proveedor, qué se considera liquidado, antelación de alertas, autorización y soporte de comprobantes.
4. **Bajas:** el estatus BAJA no guarda por sí solo fecha histórica de baja. El reporte histórico automatizado requiere evento/bitácora persistida con origen, fecha y actor.
5. **Mensajería:** probar SPF/DKIM/SMTP y entrega real a Microsoft 365, política de privacidad y notificaciones; un `ENVIADO` por SMTP no acredita lectura.
6. **Cobranza:** no mezclar fechas, cargos y saldos de diferentes planteles; todo proceso debe respetar `ScopeService` e idempotencia y mostrar vistas de error/última ejecución.
7. **Zona horaria:** `America/Mexico_City`; usar vencimiento por cargo, no aplicar retroactivamente sin autorización.

## Automatización optativa 1.27.23

En backend se agregan `COBRANZA_DIA3_HABILITADA=false`, `RECARGOS_AUTOMATICOS_HABILITADOS=false` y `FINANZAS_AUTO_ACTOR_ID`. No se habilitan al hacer merge ni al desplegar; un operador deberá activarlas tras UAT institucional. El proceso comprueba al usuario FINANZAS real y solo opera en sus planteles. Se ejecuta al iniciar y cada hora: avisos solo el día 3, con clave única estable por alumno/plantel/mes; recargos desde día 4 exclusivamente a cargos ya vencidos y con `aplicaRecargo`, una vez por cargo.

**Limitaciones operativas:** sin cuadro para habilitar por plantel; no reemplaza la conciliación SMTP ni prueba la lectura del aviso. Si el servidor permanece apagado todo el día 3 no se hará envío retroactivo. En despliegues con múltiples instancias, claves únicas de cobranza y bloqueo de recargos por cargo protegen de duplicidad, pero se requiere ensayo de concurrencia. La bitácora conserva el actor. El día 5 sigue siendo vencimiento por defecto: una colegiatura con vencimiento 5 no recibe recargo el día 4. Debe aprobarse cualquier modificación de vencimientos antes de activar la bandera.

## Aceptación 1.27.21

- FINANZAS y ADMINISTRATIVO descargan un XLSX de bajas actuales solo de planteles autorizados; el conjunto se limita a 5000 registros.
- Un alumno descarga solo su PDF autenticado; FINANZAS/ADMINISTRATIVO consultan PDF de alumnos dentro de su alcance financiero.
- Cada PDF incluye total aplicado, saldo pendiente, cargos y movimientos con estado. Todos los archivos se generan bajo demanda sin almacenar datos financieros públicos.
- No se programan mensajes ni recargos y no hay migraciones para esta entrega.
- QA pendiente: pruebas reales MySQL/SQL Server, verificación de streaming Excel/PDF, límites, privacidad entre planteles y UAT con datos controlados.
