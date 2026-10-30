# Revisión UX de identidad · 1.35.6

## Causa observada
En `web/src/pages/Usuarios.tsx` la captura se presentaba como «Nombre → Primer apellido → Correo → Segundo apellido». La rejilla horizontal también dejaba espacio excesivo y el botón Crear aparecía antes de planteles. No existía el segundo nombre como atributo independiente.

## Corrección
- Orden de lectura/teclado común: **Nombre → Segundo nombre (opcional) → Primer apellido → Segundo apellido → Correo institucional**.
- Se utiliza una cuadrícula de tres columnas en escritorio, dos en tablet y una en móvil; las etiquetas y objetivos son semánticos y con ancho flexible.
- Ambos apellidos son requeridos en nuevas altas y correcciones; el segundo nombre se puede dejar vacío. Se valida en formularios y en NestJS.
- Personal: el botón «Crear» queda tras roles y planteles.
- Alumno: contexto (plantel/matrícula/CURP), identidad y después acceso. Docente: matrícula laboral, identidad y contacto.
- Expo Android/iOS y Expo Web: consulta de nombre y apellidos en Perfil; los cambios de identidad solo se realizan mediante personal autorizado en web.
- Al editar una cuenta histórica, el valor completo de `nombre` se mantiene, `segundoNombre` aparece vacío si no existe. No se dividen nombres compuestos automáticamente.

## Validación exigida por las skills locales
Se leyeron `.agents/skills/iua-arquitectura-contexto/SKILL.md`, `iua-auditoria-ux-accesibilidad`, `iua-expo-alumno`, `iua-recorridos-uat` y `iua-revision-pr-entrega`.

Verificación CI (aún pendiente): `cd backend && npm run lint && npm run typecheck && npm test && npm run build`; `cd web && npm run lint && npm test && npm run build && npm run test:responsive`; `cd mobile && npm test && npx tsc --noEmit && npm run build:web`; `node scripts/check-agent-skills.cjs` y `node scripts/check-project-consistency.cjs`.

UAT: SUPERADMIN crea personal con/sin segundo nombre; ADMINISTRATIVO registra alumnos; docente con/ sin segundo nombre; edición de nombres históricos, navegador 360/768/1280/1920 a 200% zoom, tabulación, mensajes de error; alumno Expo sólo consulta. Comprobar formulario ante fallo de red y que no pierda los datos.

## Dependencia
Este PR se apila sobre 1.35.5: primero respaldar y aplicar migraciones espejo MySQL/SQL Server para `usuarios.segundo_nombre`; después actualizar API, web y Expo. No se realizó despliegue, ni UAT en dispositivos físicos. No se agregó dependencia.
