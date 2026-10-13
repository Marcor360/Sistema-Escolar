const { chromium, expect } = require('@playwright/test');
const { spawn } = require('node:child_process');
const { resolve } = require('node:path');
const root = resolve(__dirname, '..');
const baseUrl = 'http://127.0.0.1:5182';
const server = spawn(
  process.execPath,
  [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5182', '--strictPort'],
  { cwd: root, env: { ...process.env, VITE_API_URL: '/api' }, stdio: ['ignore', 'pipe', 'pipe'] },
);
let serverLogs = '';
server.stdout.on('data', (chunk) => {
  serverLogs += chunk;
});
server.stderr.on('data', (chunk) => {
  serverLogs += chunk;
});
server.on('error', (error) => {
  serverLogs += error.message;
});
let browser;
async function esperarServidor() {
  for (let intento = 0; intento < 100; intento++) {
    if (server.exitCode !== null) throw Error(serverLogs);
    try {
      if ((await fetch(baseUrl)).ok) return;
    } catch {
      /* Vite todavía está arrancando. */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw Error('Vite no arrancó: ' + serverLogs);
}
// Smoke de presentación con API simulada; no sustituye los E2E con API y BD reales.
(async () => {
  await esperarServidor();
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}),
    headless: true,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      let data = [];
      if (path.endsWith('/auth/refresh')) data = { accessToken: 'qa-preview' };
      if (path.endsWith('/auth/me'))
        data = { id: 1, email: 'qa@example.test', nombreCompleto: 'Usuario QA', roles: [{ clave: 'SUPERADMIN' }] };
      if (path.endsWith('/configuracion/marca'))
        data = {
          nombreInstitucion:
            'Institución Educativa de Prueba con un Nombre Extenso para Verificar Navegación Responsive',
          nombreCorto: 'QA',
          logoUrl: null,
          colorPrimario: '#14343B',
          colorPrimarioOscuro: '#0E262B',
          colorAcento: '#C79A3C',
        };
      if (path.endsWith('/alumnos'))
        data = {
          datos: [
            {
              id: 1,
              matricula: 'QA-001',
              estatus: 'ACTIVO',
              usuario: {
                nombre: 'Alumno con nombre extenso',
                apellidoPaterno: 'Prueba',
                email: 'alumno.qa@example.test',
              },
              plantel: { id: 1, nombre: 'Plantel de Prueba' },
            },
          ],
          total: 1,
          pagina: 1,
          porPagina: 20,
        };
      if (path.endsWith('/reportes/resumen'))
        data = {
          alumnosActivos: 20,
          docentesActivos: 10,
          grupos: 5,
          saldoPendiente: 500,
          cargosConAdeudo: 5,
          cobradoMes: 1000,
        };
      await route.fulfill({ json: data });
    },
  );
  for (const width of [320, 360, 768, 1024, 1440, 2560, 3840]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:5182/');
    try {
      await expect(page.locator('.panel-bienvenida')).toBeVisible();
    } catch (e) {
      console.log('BODY', await page.locator('body').innerText(), 'ERRORS', errors);
      throw e;
    }
    const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
    if (sizes.scroll > sizes.width) throw Error('Overflow ' + width + ': ' + JSON.stringify(sizes));
    if (width <= 800) {
      await page.getByRole('button', { name: /Abrir menú/ }).click();
      await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
      await page.getByRole('link', { name: 'Alumnos', exact: true }).focus();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: /Abrir menú/ })).toBeFocused();
      await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
      await page.getByRole('button', { name: /Abrir menú/ }).click();
      await page.locator('.menu-fondo').click({ position: { x: width - 10, y: 850 } });
      await expect(page.getByRole('button', { name: /Abrir menú/ })).toBeFocused();
    }
    console.log('PASS responsive ' + width);
  }
  await page.setViewportSize({ width: 360, height: 900 });
  await page.getByRole('button', { name: /Abrir menú/ }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  console.log('PASS resize mobile to desktop');
  for (const width of [320, 360, 768, 1024, 1440, 2560, 3840]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:5182/alumnos');
    await expect(page.getByRole('heading', { name: 'Registrar alumno' })).toBeVisible();
    await expect(page.getByText('QA-001', { exact: true })).toBeVisible();
    const geometry = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      width: innerWidth,
      oversized: [...document.querySelectorAll('#form-alumno input,#form-alumno select')].filter(
        (e) => e.getBoundingClientRect().right > innerWidth,
      ).length,
    }));
    if (geometry.scroll > geometry.width || geometry.oversized)
      throw Error('Form overflow ' + width + ': ' + JSON.stringify(geometry));
    await page.locator('.tabla-contenedor').scrollIntoViewIfNeeded();
    await page.locator('.tabla-contenedor').evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await expect(page.getByRole('button', { name: 'Dar de baja', exact: true })).toBeInViewport();
    console.log('PASS forms/table ' + width);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  const zoom = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
  if (zoom.scroll > zoom.width) throw Error('Text zoom overflow ' + JSON.stringify(zoom));
  console.log('PASS text size 200% at desktop');
  if (errors.length) throw Error(errors.join('\n'));
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  });
