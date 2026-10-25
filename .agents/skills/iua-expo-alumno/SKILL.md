---
name: iua-expo-alumno
description: Auditar y mejorar la app Expo exclusiva de alumnos IUA, activación, accesibilidad, sesión, red y archivos privados en Android/iOS.
---
# Auditoría del cliente Expo

## Alcance
1. Leer `mobile/App.tsx`, `mobile/src`, `mobile/package.json`, `mobile/docs` y `docs/ESTADO_IMPLEMENTACION.md`.
2. Mantener Expo restringido a ALUMNO: no incorporar pantallas de control escolar, personal o FINANZAS, ni duplicar reglas de negocio de NestJS.
3. Verificar correo -> código -> contraseña en primer acceso, límite de reenvío de 60 segundos, sesión revocable, logout/inactividad 30 minutos, permisos y documentos institucionales cuando estén habilitados.
4. Validar tabulación/navegación, tipos de letra, lector de pantalla, estados de conexión lenta, reintento sin duplicar tareas y privacidad de archivos.
5. Verificar estados de cuenta y marca que entrega API, caché y revalidación; usar `SecureStore` para credenciales sensibles, jamás logs ni secretos Graph/SMTP.
6. Ejecutar `cd mobile && npm test`, `npx tsc --noEmit` y build/preview cuando el ambiente esté disponible; las pruebas Android/iOS físicas requieren evidencia independiente.

## Resultado
Matriz de pantalla/flujo, hallazgos, pruebas automatizadas disponibles, tareas de verificación física, impacto API y compatibilidad de versión instalada. Nunca marcar «Android/iOS aprobado» solo con Expo web o tests locales.
