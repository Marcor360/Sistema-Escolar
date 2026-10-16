# Consolidación 1.26.0

Corte: 16 de octubre de 2026. Versión alineada en backend, web, móvil, sus lockfiles, Expo y documentos de aceptación vigentes. El cambio de versión no acredita despliegue ni aceptación institucional.

## Revisión de ramas

Se consultaron todas las referencias remotas y los PR asociados. Las 89 ramas de trabajo coinciden con el SHA de su PR; no se encontraron cambios adicionales posteriores a sus revisiones. 67 ya estaban contenidas por ascendencia en main; 21 tenían historia alternativa de PR fusionados o propuestas expresamente sustituidas por el PR #42. La restante es la rama del PR #89 que incorpora eliminación, esta consolidación y la corrección de concurrencia SQL.

Para las 21 variantes históricas se incorporaron sus referencias como padres de un merge con estrategia `ours`: reconoce su integración previa y conserva exactamente el árbol vigente, sin restaurar implementaciones obsoletas. Las propuestas cerradas sin merge conservan ese estado en GitHub; el documento identifica su sustitución. El PR #89 se integra con merge normal e incorpora código y documentación nuevos.

Tras integrar esta versión, el criterio verificable es que todos los SHA del inventario sean ancestros de main. No se borran ramas remotas ni se reescribe su historial. Las ramas que se creen o modifiquen después de este corte requieren otra revisión.

| Rama | SHA revisado | PR | Resultado |
|---|---|---|---|
| `chore/mobile-staging-api-preview` | `ffbca7d5738b7e997f4945cb3fd247ceddeea788` | [#73](https://github.com/Marcor360/Sistema-Escolar/pull/73) | PR fusionado; historia anterior reconciliada |
| `codex/fase0-ci` | `afa04931ae002e73eb928535e4764b6f0667edb2` | [#1](https://github.com/Marcor360/Sistema-Escolar/pull/1) | PR fusionado; historia anterior reconciliada |
| `codex/runner-migraciones-db-20261003` | `d5f5d471bcde83d5fd99b1d85f4fde052b613a7f` | [#2](https://github.com/Marcor360/Sistema-Escolar/pull/2) | Commits ya contenidos en main |
| `design/onest-modern-ui` | `96922b6e1a78987a1fcf3b14b0ea385994e89839` | [#4](https://github.com/Marcor360/Sistema-Escolar/pull/4) | Commits ya contenidos en main |
| `docs/auditoria-readme-1.23.5` | `a327d41d51f9026e252c060f75c336f4a3fba745` | [#27](https://github.com/Marcor360/Sistema-Escolar/pull/27) | Commits ya contenidos en main |
| `docs/auditoria-ux-beta-recorridos-20261013` | `5acbdf1bef1df2c3645f5fc4d6605e7a136451b5` | [#29](https://github.com/Marcor360/Sistema-Escolar/pull/29) | Commits ya contenidos en main |
| `docs/depuracion-documental-20261014` | `3c8da0f76f37f3f03d50576e21ac92237e41c28c` | [#45](https://github.com/Marcor360/Sistema-Escolar/pull/45) | Commits ya contenidos en main |
| `docs/plan-ux-seguridad-piloto` | `e83f887d5e036b25115165687bc7109cec566615` | [#21](https://github.com/Marcor360/Sistema-Escolar/pull/21) | Commits ya contenidos en main |
| `docs/requerimiento-archivos-calendario-mobile-resiliencia` | `d94e7fddb3a85122cff06d281e8a839a824cd29c` | [#12](https://github.com/Marcor360/Sistema-Escolar/pull/12) | Commits ya contenidos en main |
| `docs/requerimiento-edicion-integral-expedientes` | `622682bea604c50e616f1ba467df93432f9eb59d` | [#11](https://github.com/Marcor360/Sistema-Escolar/pull/11) | Commits ya contenidos en main |
| `feat/1.19.0-responsive-shell` | `13a58a58a1b194480d78154c8f83ed3d8ddaa022` | [#6](https://github.com/Marcor360/Sistema-Escolar/pull/6) | Commits ya contenidos en main |
| `feat/1.20.0-design-system` | `29a72bab4bc949e7f9dbf94757f57f1abd674f0f` | [#7](https://github.com/Marcor360/Sistema-Escolar/pull/7) | Commits ya contenidos en main |
| `feat/1.21.0-role-dashboards` | `37b12a7931f4c25c7958a3ea7d40f49c95aad259` | [#8](https://github.com/Marcor360/Sistema-Escolar/pull/8) | Commits ya contenidos en main |
| `feat/1.22.0-loading-states` | `79c0d8c50fd70fbbe809212fc0514145ccf925e7` | [#9](https://github.com/Marcor360/Sistema-Escolar/pull/9) | Commits ya contenidos en main |
| `feat/1.23.0-tabler-icons` | `b4c743629e86144dce28f7015903bd916604bba2` | [#10](https://github.com/Marcor360/Sistema-Escolar/pull/10) | Commits ya contenidos en main |
| `feat/admin-password-reset-20261016` | `97dab54ef69e7cd8af451bcbcd68860125ee25a7` | [#78](https://github.com/Marcor360/Sistema-Escolar/pull/78) | Commits ya contenidos en main |
| `feat/app-alumno-documentos-cache-20261014` | `8d6cae694a13054cf28453d8c931474a69b9d1f5` | [#44](https://github.com/Marcor360/Sistema-Escolar/pull/44) | Commits ya contenidos en main |
| `feat/app-guided-navigation` | `05f4fc5cadffa92e689d433127e8a89ed721cc14` | [#88](https://github.com/Marcor360/Sistema-Escolar/pull/88) | Commits ya contenidos en main |
| `feat/automatic-student-invitations-20261016` | `7211bdee44e1c65cf119bb1aaade77349a1a65de` | [#82](https://github.com/Marcor360/Sistema-Escolar/pull/82) | Commits ya contenidos en main |
| `feat/calendario-edicion-segura-20261013` | `c9ab35ad0f4a9f18ca52aa0de60c43c49f844bfb` | [#38](https://github.com/Marcor360/Sistema-Escolar/pull/38) | Sustituida por PR #42; historia reconciliada |
| `feat/calendario-edicion-web-20261013` | `743c08f4278e0ecd75b2da59d0719ca5b700c788` | [#39](https://github.com/Marcor360/Sistema-Escolar/pull/39) | Sustituida por PR #42; historia reconciliada |
| `feat/email-templates-iua-20261016` | `e9654968dfd425825a9dccd1971269da93da88ce` | [#81](https://github.com/Marcor360/Sistema-Escolar/pull/81) | Commits ya contenidos en main |
| `feat/entregas-beta-auditoria` | `5bc9063613211e78e3ee20b72666d2c446f1e3bd` | [#42](https://github.com/Marcor360/Sistema-Escolar/pull/42) | Commits ya contenidos en main |
| `feat/iua-60-activation-schema` | `2323b5015cf5409615d036fffe82610ea225b0ec` | [#60](https://github.com/Marcor360/Sistema-Escolar/pull/60) | Commits ya contenidos en main |
| `feat/iua-61-account-activation-api` | `b63a0540b950e2987d0e536119f0e2de27109eee` | [#61](https://github.com/Marcor360/Sistema-Escolar/pull/61) | Commits ya contenidos en main |
| `feat/iua-62-student-provisioning` | `97f09a9865d8a97ac5d6d334a1c7152196ad8cfb` | [#62](https://github.com/Marcor360/Sistema-Escolar/pull/62) | Commits ya contenidos en main |
| `feat/iua-63-activation-clients` | `3465fc2959f6b6b238521ff70ce110b87330ef81` | [#63](https://github.com/Marcor360/Sistema-Escolar/pull/63) | Commits ya contenidos en main |
| `feat/mobile-home-without-tasks-20261016` | `d7ad22906f48267519d4cc16daf25ae9e451c8ad` | [#80](https://github.com/Marcor360/Sistema-Escolar/pull/80) | Commits ya contenidos en main |
| `feat/mobile-materias-resiliencia` | `c3eaebdbfa13e7d87e7fe9e5b26af72d15b38887` | [#18](https://github.com/Marcor360/Sistema-Escolar/pull/18) | Commits ya contenidos en main |
| `feat/password-help-campus-notice-20261016` | `38e6313ec975468d9c98a53b1f43f1affb2b744f` | [#84](https://github.com/Marcor360/Sistema-Escolar/pull/84) | Commits ya contenidos en main |
| `feat/plantilla-xlsx-calificaciones-20261013` | `dfceb8843ae0dd17dba58a67f0407479e57d4105` | [#37](https://github.com/Marcor360/Sistema-Escolar/pull/37) | Sustituida por PR #42; historia reconciliada |
| `feat/preparacion-beta-ux-seguridad` | `c5507c7b268b8f09932d1153808b6fb10d0060d9` | [#28](https://github.com/Marcor360/Sistema-Escolar/pull/28) | Commits ya contenidos en main |
| `feat/safe-record-deletion` | `94c2b8cb8b7b29f512e4963de8eb606a9e065254` | [#89](https://github.com/Marcor360/Sistema-Escolar/pull/89) | Incluida mediante este PR |
| `feat/smtp-staging-delivery-20261016` | `a110725a54bb79d0ce2bff22cad7865271029552` | [#77](https://github.com/Marcor360/Sistema-Escolar/pull/77) | Commits ya contenidos en main |
| `feat/ux-alta-plantel-guiada-20261013` | `4226606330cbdf64acd8d15c30171071f9b9eae3` | [#30](https://github.com/Marcor360/Sistema-Escolar/pull/30) | Commits ya contenidos en main |
| `feat/ux-alumnos-consulta-listado` | `559b162234ae85bdd99183e22712833abb96086e` | [#17](https://github.com/Marcor360/Sistema-Escolar/pull/17) | Commits ya contenidos en main |
| `feat/ux-alumnos-inscripcion-20261013` | `52617b4db786780448827a9f1b6e2ea986e6574d` | [#32](https://github.com/Marcor360/Sistema-Escolar/pull/32) | Sustituida por PR #42; historia reconciliada |
| `feat/ux-calificaciones-responsive-20261013` | `f0bfa1345e9b0fc4a999d82959e5d370cf9cdae4` | [#35](https://github.com/Marcor360/Sistema-Escolar/pull/35) | Sustituida por PR #42; historia reconciliada |
| `feat/ux-docentes-lista-adaptable` | `4b278d2dac95e7ee937582eb9758a8287ab7b259` | [#15](https://github.com/Marcor360/Sistema-Escolar/pull/15) | Commits ya contenidos en main |
| `feat/ux-grupos-listado-resiliente` | `8d80e6519154d0a5527c80fa892bd1007c21fb7d` | [#19](https://github.com/Marcor360/Sistema-Escolar/pull/19) | Commits ya contenidos en main |
| `feat/ux-grupos-pasos-inscripcion-20261013` | `8e433d1faad80e8c89e610ddc9beca5ea96276ec` | [#33](https://github.com/Marcor360/Sistema-Escolar/pull/33) | Sustituida por PR #42; historia reconciliada |
| `feat/ux-importaciones-validacion-20261013` | `036448f513197866012fdec1a1872a743c17be79` | [#36](https://github.com/Marcor360/Sistema-Escolar/pull/36) | Sustituida por PR #42; historia reconciliada |
| `feat/ux-materias-ciclos-responsive-20261013` | `f65561fc28994d16649e3ec0954908c6b0d13902` | [#34](https://github.com/Marcor360/Sistema-Escolar/pull/34) | Sustituida por PR #42; historia reconciliada |
| `feat/ux-planteles-lista-adaptable` | `b527b1374203cc063a0c1acbeb78e6f883f61b82` | [#16](https://github.com/Marcor360/Sistema-Escolar/pull/16) | Commits ya contenidos en main |
| `feat/ux-usuarios-tabla-responsive-20261013` | `32e917a69ee65b25092d745220ab049139b43af1` | [#31](https://github.com/Marcor360/Sistema-Escolar/pull/31) | Sustituida por PR #42; historia reconciliada |
| `feat/web-editar-planteles` | `980d7b3355ee4a61b15d9636808fe5b99aa0dcb9` | [#74](https://github.com/Marcor360/Sistema-Escolar/pull/74) | PR fusionado; historia anterior reconciliada |
| `feat/web-plantilla-calificaciones-20261013` | `a3a2c1c40b8a245ad0d93956e0f0abdd7bffa565` | [#40](https://github.com/Marcor360/Sistema-Escolar/pull/40) | Sustituida por PR #42; historia reconciliada |
| `feature/alumnos-credenciales-matricula-curp` | `8e4aa9046f0edb24e0f88677529fc2947cddab29` | [#3](https://github.com/Marcor360/Sistema-Escolar/pull/3) | Commits ya contenidos en main |
| `fix/barrido-responsive-20261015` | `f87e7bf350d10ef0c6d568e2aa0aac00bb4ad863` | [#59](https://github.com/Marcor360/Sistema-Escolar/pull/59) | Commits ya contenidos en main |
| `fix/importaciones-roles-alumnos-20261016` | `fde52dffcc092ec0473f45915ae10f3b41d60c51` | [#79](https://github.com/Marcor360/Sistema-Escolar/pull/79) | Commits ya contenidos en main |
| `fix/inactividad-30m-web-mobile-beta-20261014` | `a8108bf458b3fe6903c79b92b8c0e5aef2bc9ba0` | [#46](https://github.com/Marcor360/Sistema-Escolar/pull/46) | Commits ya contenidos en main |
| `fix/iua-64-push-idle-session` | `12b5e5e065b554cee1b954cd62410ab659989557` | [#64](https://github.com/Marcor360/Sistema-Escolar/pull/64) | Commits ya contenidos en main |
| `fix/iua-65-web-api-build-validation` | `30daaa9cfdaa7f63c2c92c72a479889f133023c7` | [#65](https://github.com/Marcor360/Sistema-Escolar/pull/65) | Commits ya contenidos en main |
| `fix/iua-66-picker-preflight` | `34fa9f02319a3cb6ae74d972ee043ce10b644e25` | [#66](https://github.com/Marcor360/Sistema-Escolar/pull/66) | Commits ya contenidos en main |
| `fix/iua-67-student-curp-privacy` | `75d334a4e2a29669adb8dc9437d9cb4dde72e209` | [#67](https://github.com/Marcor360/Sistema-Escolar/pull/67) | Commits ya contenidos en main |
| `fix/logo-preview-and-diagnostics` | `3e46e6dceddd1d6c050c5fe49895882b86827a5b` | [#72](https://github.com/Marcor360/Sistema-Escolar/pull/72) | PR fusionado; historia anterior reconciliada |
| `fix/mobile-calificaciones-sesion-orden-20261013` | `ddcf1fbf8e9dbd84cc66c2eea0609960d596e7e5` | [#41](https://github.com/Marcor360/Sistema-Escolar/pull/41) | Sustituida por PR #42; historia reconciliada |
| `fix/mobile-inicio-cargas-parciales-20261013` | `995f7afa9e874e54022be8c865f116d05c21b422` | [#22](https://github.com/Marcor360/Sistema-Escolar/pull/22) | PR fusionado; historia anterior reconciliada |
| `fix/mobile-menu-right-drawer` | `c14095aae6305a7048587f30d0511b47afffb4da` | [#14](https://github.com/Marcor360/Sistema-Escolar/pull/14) | Commits ya contenidos en main |
| `fix/plantillas-masivas-legibles-20261014` | `f7e97f02d08d9275acae90fcf86cfab2b7211b08` | [#43](https://github.com/Marcor360/Sistema-Escolar/pull/43) | Commits ya contenidos en main |
| `fix/smtp-invalid-port-20261016` | `2edb048807d04548a47436a282fbe1c4d89968ee` | [#86](https://github.com/Marcor360/Sistema-Escolar/pull/86) | Commits ya contenidos en main |
| `fix/staging-deploy-1.23.1` | `c7986565baa24da7f42a2d44d493080c789520fd` | [#13](https://github.com/Marcor360/Sistema-Escolar/pull/13) | PR fusionado; historia anterior reconciliada |
| `fix/staging-doc-health-ready` | `2066a998b2cc06969345d2f5a591e82ecc121d93` | [#20](https://github.com/Marcor360/Sistema-Escolar/pull/20) | Commits ya contenidos en main |
| `fix/student-create-finance-superadmin-20261016` | `252c19848dfba94dd58fce63aabf555fbb2d1549` | [#76](https://github.com/Marcor360/Sistema-Escolar/pull/76) | Commits ya contenidos en main |
| `fix/ui-controls-responsive-iua` | `7101d22a533a294a4adb7ef6444f8f4ddd4edca5` | [#71](https://github.com/Marcor360/Sistema-Escolar/pull/71) | PR fusionado; historia anterior reconciliada |
| `fix/web-alumnos-filtros-paginacion-20261013` | `a278057103657b96c6f61553153ec5443d2b3104` | [#25](https://github.com/Marcor360/Sistema-Escolar/pull/25) | Commits ya contenidos en main |
| `fix/web-calendario-acciones-permitidas-20261013` | `5a90a16ba16ce5fdd46d433da1045b7bfa6ac8be` | [#26](https://github.com/Marcor360/Sistema-Escolar/pull/26) | Commits ya contenidos en main |
| `fix/web-cuenta-sesion-20261013` | `0f1f7fb9d9a21e8a241eb1c442209e955c2052b2` | [#23](https://github.com/Marcor360/Sistema-Escolar/pull/23) | PR fusionado; historia anterior reconciliada |
| `fix/web-docentes-detalle-concurrente-20261013` | `38bef62b6e6ab0030043a4033716fcd79a78ecc8` | [#24](https://github.com/Marcor360/Sistema-Escolar/pull/24) | PR fusionado; historia anterior reconciliada |
| `ops/iua-68-readiness-windows` | `d5e4ec02d598e91ffd157791ab16478f47ef8d47` | [#68](https://github.com/Marcor360/Sistema-Escolar/pull/68) | Commits ya contenidos en main |
| `ops/staging-readonly-check-20261016` | `d0449f55fec393a66c9ec377d021859015a664af` | [#87](https://github.com/Marcor360/Sistema-Escolar/pull/87) | Commits ya contenidos en main |
| `privacy/iua-10-document-picker-hardening` | `aee31a1d3dc5e526e4a0a85f2dee9302bb66bdc4` | [#56](https://github.com/Marcor360/Sistema-Escolar/pull/56) | Commits ya contenidos en main |
| `qa/iua-06-calificaciones-flujo` | `802847879ac164c8cd60be5ec603306b0f42a452` | [#52](https://github.com/Marcor360/Sistema-Escolar/pull/52) | Commits ya contenidos en main |
| `qa/iua-07-entregas-flujo` | `79f09b1681bb4746823b52d98069cee33ff3c24d` | [#53](https://github.com/Marcor360/Sistema-Escolar/pull/53) | Commits ya contenidos en main |
| `qa/iua-08-boletas-privadas` | `18372e77ea1283f11dd7365860ef80454c0e9f23` | [#54](https://github.com/Marcor360/Sistema-Escolar/pull/54) | Commits ya contenidos en main |
| `qa/iua-09-finanzas-alumno` | `af2d9475865152c0d0879e1fde720a5dfc564ad7` | [#55](https://github.com/Marcor360/Sistema-Escolar/pull/55) | Commits ya contenidos en main |
| `qa/iua-69-pilot-uat-matrix` | `a32f33859f1b59c7cc0e358aab6ba1d567558841` | [#69](https://github.com/Marcor360/Sistema-Escolar/pull/69) | Commits ya contenidos en main |
| `release/1.25.0-beta.1-consolidacion` | `00bb1373e9915a9e0e99ff31a67258eb250a3790` | [#75](https://github.com/Marcor360/Sistema-Escolar/pull/75) | Commits ya contenidos en main |
| `security/iua-01-session-activity-schema` | `82d3c02632ed5a486f8b6676fb4b7caf60574dd1` | [#47](https://github.com/Marcor360/Sistema-Escolar/pull/47) | Commits ya contenidos en main |
| `security/iua-02-session-expiration-api` | `bb0b0e7c0089bf9f56a8aac0f0791d736a2a6f3d` | [#48](https://github.com/Marcor360/Sistema-Escolar/pull/48) | Commits ya contenidos en main |
| `security/iua-03-web-activity-sync` | `53bff470a1eb1543be847c1d28b911283ab694f2` | [#49](https://github.com/Marcor360/Sistema-Escolar/pull/49) | Commits ya contenidos en main |
| `security/iua-04-mobile-activity-sync` | `b80c654e6b68c9329db9b2c30eccc9d72b153d17` | [#50](https://github.com/Marcor360/Sistema-Escolar/pull/50) | Commits ya contenidos en main |
| `security/iua-05-session-security-regressions` | `1fa70afb436bc0fa597e6906ee866a19f1d89d2a` | [#51](https://github.com/Marcor360/Sistema-Escolar/pull/51) | Commits ya contenidos en main |
| `security/smtp-enforce-tls-deploy-20261015` | `b51bfe7fdc9b0c624df3de14888f9902de924309` | [#70](https://github.com/Marcor360/Sistema-Escolar/pull/70) | PR fusionado; historia anterior reconciliada |
| `stability/iua-12-network-recovery` | `94fd50cc9729d53e1fbc801ab953c89fddb793cb` | [#58](https://github.com/Marcor360/Sistema-Escolar/pull/58) | Commits ya contenidos en main |
| `test/importaciones-role-regression-20261016` | `137b04f433559b11afe1ca71aaad3c8080ef8220` | [#83](https://github.com/Marcor360/Sistema-Escolar/pull/83) | Commits ya contenidos en main |
| `test/scope-regression-matrix-20261016` | `0d2075f6981ed6f1cd5b543a5baec619fe1790a8` | [#85](https://github.com/Marcor360/Sistema-Escolar/pull/85) | Commits ya contenidos en main |
| `ux/experiencia-fases-2-5` | `640cc89019ceafadff643b6992b334cce31ba8e3` | [#5](https://github.com/Marcor360/Sistema-Escolar/pull/5) | Commits ya contenidos en main |
| `ux/iua-11-mobile-tab-accessibility` | `a3373e0e6e4aa37404a5e76e11502a74fd04bf7f` | [#57](https://github.com/Marcor360/Sistema-Escolar/pull/57) | Commits ya contenidos en main |
