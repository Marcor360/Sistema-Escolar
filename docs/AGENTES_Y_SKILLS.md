# Agentes y skills para el Sistema Escolar IUA

**Corte:** 25/oct/2026 · propuesta 1.27.43. Estas herramientas estructuran el trabajo de Codex y agentes compatibles; **no conceden acceso a cuentas reales ni ejecutan cambios en servidores**.

## Modo de uso

- `AGENTS.md` mantiene restricciones permanentes de arquitectura, privacidad y validación.
- `.agents/skills/<nombre>/SKILL.md` define un flujo reutilizable. Codex descubre skills locales desde la raíz del repositorio; en Codex CLI/IDE pueden invocarse explícitamente con `$nombre-de-skill` o elegirse según su descripción. Reiniciar Codex si una skill no aparece.
- Para una revisión inicial: `$iua-arquitectura-contexto` y luego `$iua-auditoria-seguridad`, `$iua-auditoria-ux-accesibilidad` o `$iua-recorridos-uat`, según el objetivo.
- Skills son **instrucciones**, no agentes residentes: no se ejecutan solas al subir un commit. El workflow `.github/workflows/auditoria-agentes.yml` ejecuta validación de skills/contratos en PRs pertinentes y, una vez fusionado, un smoke semanal Playwright con API simulada. CI actual ya hace recorridos Playwright con API/BD aisladas en los PRs.
- Reportes de IA deben indicar SHA, archivos/funciones verificados, comandos ejecutados, fallos y evidencia pendiente; nunca confundir pruebas automatizadas con aceptación institucional.

## Catálogo incluido

| Skill | Cuándo invocarla | Evidencia principal |
| --- | --- | --- |
| `iua-arquitectura-contexto` | Al empezar o entender módulos y dependencias | Mapa API/web/Expo/BD con estado real |
| `iua-auditoria-seguridad` | Autorización, ScopeService, privacidad, JWT, uploads y pagos | Hallazgos con gravedad y prueba |
| `iua-recorridos-uat` | Alta, inscripción, docentes, finanzas y alumno | UAT-ID y resultados Playwright |
| `iua-auditoria-ux-accesibilidad` | Responsive, teclado, contraste y tutoriales web | Defectos por viewport/rol |
| `iua-expo-alumno` | Activación, sesiones, offline, documentos y permisos móvil | Matriz Android/iOS + API |
| `iua-migraciones-datos` | TypeORM, schema, MySQL/SQL Server y cambios de datos | Migraciones espejo y restore pendiente |
| `iua-finanzas-escolares` | Cartera, precios por periodo, becas, recargos y estados de cuenta | Reglas aprobadas vs. propuestas |
| `iua-correo-institucional` | Enrutamiento GoDaddy/Graph, activación y recuperación | Matriz proveedor/cola/entrega |
| `iua-revision-pr-entrega` | Cambios para merge, versionado, CI y despliegue | Gate por SHA y plan seguro |

## Repositorios externos examinados (NO copiados al proyecto)

| Recurso | Aporte aprovechable | Integración elegida |
| --- | --- | --- |
| [obra/superpowers](https://github.com/obra/superpowers) | Debug sistemático, TDD, revisión previa, verificación antes de cerrar | Adoptar proceso y evidencia en nuestras skills; no instalar hooks globales obligatorios |
| [anthropics/skills](https://github.com/anthropics/skills) | Formato SKILL.md, recursos por tarea, divulgación progresiva | Skills propias, con el contrato escolar; no copiar licencias ni scripts externos |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | Rendimiento React/React Native, composición y guías UX | Priorizar revisiones React/Expo; recomendaciones no sustituyen tests locales |
| [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | Exploración guiada del navegador y árbol de accesibilidad | Opcional en equipo local aislado; la automatización de CI usa Playwright ya instalado |
| [dequelabs/axe-core](https://github.com/dequelabs/axe-core) | Detección automática de ciertos fallos WCAG | Candidato a PR posterior con baseline y falsos negativos manuales |
| [GoogleChrome/lighthouse-ci](https://github.com/GoogleChrome/lighthouse-ci) | Umbrales de accesibilidad, rendimiento y regresiones | Candidato posterior tras establecer presupuestos y página autenticada de prueba |
| [github/awesome-copilot](https://github.com/github/awesome-copilot) | Catálogo de skills de revisión y auditoría de seguridad | Selección manual; revisar comandos, licencias y riesgo de instrucciones externas |
| [openai/skills](https://github.com/openai/skills) | Antecedentes de skill para Codex; catálogo señalado como obsoleto en su README | Preferir [documentación actual](https://learn.chatgpt.com/docs/build-skills) para autoría |

No se copia código ajeno: primero se revisan licencia, mantenimiento, permisos y conveniencia. No se ejecutan instaladores remotos por defecto.

## Orden seguro de auditoría

1. **Lectura:** arquitectura, matriz de permisos, contratos de negocio, tests y estado del último SHA.
2. **Análisis:** auditoría de seguridad y privacidad; tabla de escenarios UAT, riesgo y cobertura.
3. **Ejecución aislada:** comandos de lint, types, tests, Playwright con API simulada y pruebas de integración con BD descartable. No usar la BD de staging.
4. **Corrección:** PR independiente con pruebas, versión única y revisión de impacto; no fusionar automáticamente.
5. **UAT externo:** validación por autoridades responsables, dispositivos físicos, IIS, SMTP/Graph, backups/restore, antivirus y pasarela; registrar evidencia en matrices solo con autorización.

## Ejecutar controles

```bash
node scripts/check-agent-skills.cjs
node --test scripts/check-agent-skills.test.cjs
node scripts/check-uat-matrix.cjs
node scripts/check-beta-gates.cjs
cd web && npm run test:responsive
```

El último comando requiere dependencias y navegador Playwright ya instalados. El workflow programado corre semanalmente en rama por defecto **solo después de integrar el PR**. No sustituye `.github/workflows/ci.yml`, que comprueba backend, web, Expo, MySQL, SQL Server y E2E. No se generan correos, cargos, migraciones ni despliegues por programar auditorías.
