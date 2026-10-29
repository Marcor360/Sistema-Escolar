const { chromium, expect } = require('@playwright/test');
const { spawn } = require('node:child_process');
const { resolve } = require('node:path');
const root = resolve(__dirname, '..'),
  base = 'http://127.0.0.1:5191';
const server = spawn(
  process.execPath,
  [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5191', '--strictPort'],
  { cwd: root, env: { ...process.env, VITE_API_URL: '/api' }, stdio: 'ignore' },
);
let browser;
(async () => {
  for (let n = 0; n < 100; n++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}),
  });
  for (const rol of ['SUPERADMIN', 'MAESTRO'])
    for (const width of [360, 768, 1280, 1920]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } }),
        errores = [],
        envios = [];
      page.on('pageerror', (e) => errores.push(e.message));
      const historial = [
        {
          id: 1,
          estado: 'REVISION',
          comentario: 'Solicito revisar Matemáticas.',
          firmanteNombre: 'Tutor QA',
          firmanteTipo: 'TUTOR',
          asignatura: null,
          fecha: '2026-10-29T12:00:00Z',
          vigente: true,
        },
      ];
      await page.route(
        (u) => u.pathname.startsWith('/api/'),
        async (route) => {
          const p = new URL(route.request().url()).pathname;
          let data = [];
          if (p.endsWith('/auth/refresh')) data = { accessToken: 'boletas-qa' };
          if (p.endsWith('/auth/me'))
            data = { id: 1, email: 'qa@example.invalid', nombreCompleto: 'Personal QA', roles: [{ clave: rol }] };
          if (p.endsWith('/configuracion/marca'))
            data = {
              nombreInstitucion: 'Escuela QA',
              nombreAdministrativo: 'Sistema Escolar Administrativo',
              nombrePortalAlumno: 'Sistema Escolar Portal Alumno',
              nombreCorto: 'QA',
              logoUrl: null,
              colorPrimario: '#14343B',
              colorPrimarioOscuro: '#0E262B',
              colorAcento: '#C79A3C',
              actualizadoEn: '2026-10-29T12:00:00Z',
            };
          if (p.endsWith('/planteles/mios')) data = [{ id: 1, nombre: 'Centro' }];
          if (p.endsWith('/seguimiento/pendientes'))
            data = [
              { titulo: 'Carteras en pausa', cantidad: 3, ruta: '/apertura-cartera?vista=consulta&estado=PAUSA' },
            ];
          if (p.endsWith('/seguimiento/calidad'))
            data = { incompletos: [], duplicados: [], gruposSinNivel: [], inscripcionesInconsistentes: [] };
          if (p.endsWith('/seguimiento/respaldo'))
            data = { estado: 'SIN_CONFIGURAR', vencido: true, ultimoExito: null };
          if (p.endsWith('/boletas/seguimiento'))
            data = {
              datos: [
                {
                  id: 1,
                  inscripcionId: 8,
                  alumno: 'Alumno QA',
                  matricula: 'QA8',
                  estado: 'REVISION',
                  fecha: '2026-10-29T12:00:00Z',
                  vigente: true,
                },
              ],
              total: 1,
              pagina: 1,
              porPagina: 10,
            };
          if (p.endsWith('/boletas/inscripciones/8'))
            data = {
              inscripcionId: 8,
              alumnoId: 9,
              alumno: 'Alumno QA',
              matricula: 'QA8',
              disponible: true,
              versionHash: 'a'.repeat(64),
              estado: 'REVISION',
              materias: [{ grupoMateriaId: 4, asignatura: 'Matemáticas', promedioFinal: 8, observaciones: '' }],
              materiasDocente: rol === 'MAESTRO' ? [{ grupoMateriaId: 4, asignatura: 'Matemáticas' }] : [],
              historial,
            };
          if (p.endsWith('/boletas/inscripciones/8/comentarios')) {
            envios.push(route.request().postDataJSON());
            historial.push({
              id: 2,
              estado: 'COMENTARIO',
              comentario: envios[0].comentario,
              firmanteNombre: 'Docente QA',
              firmanteTipo: 'DOCENTE',
              asignatura: 'Matemáticas',
              fecha: '2026-10-29T12:05:00Z',
              vigente: true,
            });
            data = { id: 2 };
          }
          await route.fulfill({ json: data });
        },
      );
      await page.goto(base + '/boletas?estado=REVISION');
      await expect(page.getByRole('link', { name: 'Abrir boleta y comentarios' })).toBeVisible();
      if (await page.getByRole('button', { name: 'Omitir recorrido' }).count())
        await page.getByRole('button', { name: 'Omitir recorrido' }).click();
      await page.getByRole('link', { name: 'Abrir boleta y comentarios' }).click();
      await expect(page.getByText('Solicito revisar Matemáticas.')).toBeVisible();
      if (rol === 'MAESTRO') {
        await page.getByLabel('Materia', { exact: true }).selectOption('4');
        await page.getByLabel('Comentarios para revisión').fill('La evaluación fue revisada en la materia.');
        await page.getByRole('button', { name: 'Publicar comentario de materia' }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
        await expect.poll(() => envios.length).toBe(1);
        await expect(
          page.locator('.boleta-evento').getByText('La evaluación fue revisada en la materia.'),
        ).toBeVisible();
        expect(envios[0].grupoMateriaId).toBe(4);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      expect(
        await page.evaluate(async () =>
          (
            await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })
          ).violations.map((v) => v.id),
        ),
      ).toEqual([]);
      expect(errores).toEqual([]);
      console.log('PASS boletas ' + rol + ' ' + width);
      await page.close();
    }
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    server.kill();
  });
