# Integridad y seguridad 1.16.1

8 de octubre de 2026. Base: c458b7e (1.16.0). Sin cambios de endpoints, baseline ni DDL; no requiere migración nueva.

La política `common/politica-acceso.ts` define capacidades académicas, financieras y maestro restringido. Se aplica a calificaciones, grupos, alumnos, listado de usuarios, calendario y analítica. FINANZAS ya no elimina la restricción de clase asignada; ADMINISTRATIVO sí concede la gestión académica por plantel. La analítica entrega simultáneamente clases propias y finanzas autorizadas para MAESTRO+FINANZAS.

GET calendario declara roles explícitos y rechaza FINANZAS solo. Promoción bloquea ciclos, plantel y grupos en orden determinista dentro de la transacción, revalida estados y luego bloquea alumnos. Una desactivación concurrente no puede dejar nuevas inscripciones activas en grupo inactivo.

La integración añade matriz MAESTRO, FINANZAS, MAESTRO+FINANZAS, ADMINISTRATIVO+MAESTRO, ADMINISTRATIVO+FINANZAS, SUPERADMIN: alumno, grupo, notas propias/ajenas, captura, Excel, calendario, conducta, finanzas y bloques de analítica. La carrera usa un bloqueo real con señal de consulta, sin depender de pausas arbitrarias. Suite: 47 casos normales / 49 con Chromium, en bases nuevas y DB_SYNC=false. Backend conserva strict, lint y sus 154 pruebas unitarias.

README, matriz y versiones backend/web/móvil/Expo actualizados. Las correcciones técnicas no certifican el servidor ni el piloto; permanecen los requisitos externos de CORRECCIONES_1.16.0.md.
