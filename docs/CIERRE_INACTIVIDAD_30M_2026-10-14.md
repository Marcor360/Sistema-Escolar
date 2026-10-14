# Correcciones de sesión e inactividad · 2026-10-14

## Alcance
Web para MAESTRO, ADMINISTRATIVO, FINANZAS y SUPERADMIN; Expo exclusivamente ALUMNO. API sin cambios, ninguna dependencia nueva, sin migraciones ni cambios en módulos administrativos. Base de trabajo: `main`, `1.24.0-beta.2`.

## Contrato de inactividad: 30 minutos
- Ambos clientes registran la **última interacción humana** y cierran la interfaz al transcurrir 30 minutos sin pulsaciones, teclas, desplazamiento o movimientos admitidos. Una consulta de datos, un refresh JWT o un temporizador de actualización **no** reinician el periodo.
- **Web** escucha puntero/teclado/touch/rueda y comprueba de nuevo al mostrar la pestaña o enfocar la ventana. Comparte el instante de última actividad entre pestañas mediante `localStorage`, sin guardar credenciales allí. Señala el cierre también a otras pestañas. El marcador de cierre impide restaurar la sesión mediante la cookie después de recargar; un login manual lo desbloquea.
- **Expo** escucha interacciones táctiles a nivel del contenedor y botón físico Atrás; comprueba `AppState` al volver de segundo plano. Almacena solamente el instante de actividad en `SecureStore` (con escrituras limitadas) para impedir una restauración posterior a 30 minutos al cerrar y reabrir la app. No almacena documentos allí.
- Cierre manual o por inactividad **libera el estado local aunque no haya internet**. Se intenta revocar la sesión en la API mediante una solicitud independiente y autenticada. Como el access JWT dura 15 minutos, si la revocación responde 401 ambos clientes intentan refrescar exclusivamente para obtener un token de revocación, sin restaurar la interfaz ni guardar credenciales nuevas. **Limitación de seguridad:** sin conexión no es posible confirmar la revocación del refresh remoto hasta que exista comunicación. El servidor mantiene por sí mismo JWT corto, sesión revocable y autorización por solicitud. Una política institucional que requiera inactividad estricta del lado servidor necesitará un contrato propio de actividad humana confiable, con vencimiento y revocación que no dependa del cliente.

## Hallazgos funcionales
- `mobile/src/screens/EstadoCuenta.tsx`: al iniciar una nueva consulta se deshabilita pagar; si falla, el estado visible se etiqueta desactualizado y permanece bloqueado. Después de cinco minutos también caduca la vigencia. Antes de generar una orden se vuelve a consultar saldo y se compara importe y cargo.
- `mobile/src/screens/Materias.tsx`: al refrescar se invalidan listados de materiales y respuestas antiguas; las carpetas vuelven a pedir documentos al abrirse.
- `mobile/src/screens/Inicio.tsx`: eventos en `America/Mexico_City`, que es la convención institucional existente.
- **Entrega de archivos**: `expo-document-picker` requiere `copyToCacheDirectory: true` para obtener una URI accesible al subir el archivo en Android/iOS. La app no mantiene la URI ni el contenido en estado persistente, y ya descarta la selección al terminar/cancelar. La eliminación explícita de copias del directorio nativo **NO se ha implementado**: requiere `expo-file-system` y un lockfile/regresión nativa controlada. No cambiar a `false` sin validar la subida porque rompería dispositivos que solo proporcionan URIs de contenido.

## Pruebas imprescindibles
1. Web: 29:59 minutos sin interacción no cierra; a 30:00 cierra, mostrando aviso. Teclado/puntero reinicia plazo; petición de fondo no lo reinicia. Dos pestañas comparten actividad y cierre; recarga no revive cookie; botón manual cierra sin internet.
2. Móvil: touch y botón Atrás reinician, peticiones automáticas no; 30 minutos en segundo plano cierran al reanudar; abrir la app tras 30 minutos muestra login; cierre manual sin red no retiene notas.
3. Finanzas: falla la carga después de mostrar cargos -> etiqueta de desactualizado y orden bloqueada; consulta 5 minutos antigua -> bloqueada; saldo modificado desde otro dispositivo -> no crea orden.
4. Materias: quitar/reemplazar archivo desde portal web y luego actualizar -> no queda vínculo antiguo en app.
5. Tareas: seleccionar/cancelar/subir PDF desde Android y iOS; monitorear residuo de caché en QA. No se certifica limpieza nativa ni antivirus desde este cambio.
6. Navegación: seis pestañas en 320 px, tamaño de letra aumentado, TalkBack/VoiceOver y dispositivos pequeños. Código conserva seis pestañas porque no se ha validado físicamente un rediseño; touch targets min. 48px donde se había definido.
7. Zona horaria: un evento creado en México presenta la hora institucional en teléfono con zona horaria distinta.

No se modifica la plantilla oficial de boletas, el acceso a biblioteca administrativa, la descarga de PDF ni la cola offline. Los ocho trabajos de CI son evidencia técnica, no sustituyen UAT ni pruebas Android/iOS físicas.

## Correcciones durante revisión de #46

La marca de actividad se escribe y se elimina mediante una misma cola: la limpieza de logout queda encolada antes de que un login nuevo pueda guardar su marca. Se evita que una eliminación tardía borre la actividad de la nueva sesión. Regresiones de almacenamiento lento y fallido, y rechazo de marcas futuras/corruptas/vencidas al restaurar. Una sesión anterior sin marca adopta el reloj actual por compatibilidad; no se presenta como prueba de inactividad previa.

Continúan los límites de revocación remota sin red y la aceptación nativa pendiente.

En web, un login nuevo cancela y espera la petición de revocación/refresh anterior antes de autenticar. Así una respuesta tardía de ese refresh no sobrescribe la cookie del nuevo login en esa pestaña. Una regresión reproduce logout con access vencido y refresh pendiente. No se atribuye a este control una garantía de coordinación de todas las autenticaciones simultáneas entre pestañas.
