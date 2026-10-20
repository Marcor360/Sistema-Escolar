# Aceptación institucional del alumno — 1.27.2

## Estado y responsabilidad legal

La implementación guarda dos aceptaciones con fecha/hora UTC del servidor y versión de cada documento. **No está habilitada por defecto**; se debe obtener aprobación jurídica/institucional sobre documentos aplicables por nivel, contenido, URL HTTPS oficial y tratamiento de datos de menores. La aceptación de un alumno menor de edad no sustituye la autorización del tutor exigida por la normativa aplicable.

La página oficial de referencia de reglamentos es https://iua.edu.mx/comunidad/ y el reglamento general publicado es https://iua.edu.mx/wp-content/uploads/2022/08/ReglamentoGRALiua.pdf. No se verificó una URL pública específica para las políticas institucionales/privacidad. No inventar ese enlace: debe proporcionarlo y aprobarlo la institución antes de activar.

## Configuración y operación

En backend.env: CONSENTIMIENTO_INSTITUCIONAL_HABILITADO=true, REGLAMENTO_ACADEMICO_URL, REGLAMENTO_ACADEMICO_VERSION, POLITICAS_INSTITUCIONALES_URL y POLITICAS_INSTITUCIONALES_VERSION, tras aprobación. Cada cambio de versión documental obliga a aceptar nuevamente.

GET /api/auth/consentimiento devuelve estado y URLs HTTPS; POST /api/auth/consentimiento persiste ambos registros en una transacción, con fecha de servidor. Mientras falte cualquiera, los endpoints protegidos del alumno en MOVIL responden 403, salvo /auth/me, /auth/actividad, /auth/logout y el propio consentimiento. La app no presenta las pestañas principales antes de consultar el estado y comprueba al reanudarse. Si se sale sin aceptar, vuelve a pedir aceptación en el siguiente inicio. No se almacena aceptación jurídica en el cliente.

### Puertas de entrada para staging

1. Aprobar documentos por nivel y política para menores/tutores; publicar URLs HTTPS oficiales y asignar versiones únicas.
2. Respaldar, aplicar migración incremental y verificar historial antes de desplegar una API que use las tablas.
3. Ensayar no aceptación, doble confirmación, rechazo, reconexión, renovación de versiones, roles combinados y cambios de dispositivo.
4. Acreditar conformidad legal y UAT. Un alumno menor no sustituye por sí mismo firma de padre o tutor.
5. No eliminar evidencias al revertir una release; las migraciones no tienen DOWN destructivo.
