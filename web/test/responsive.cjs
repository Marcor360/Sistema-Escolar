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
      if (path.endsWith('/analitica'))
        data = {
          modo: 'VIGENTE',
          ciclo: { nombre: 'Ciclo QA' },
          generadoEn: '2026-10-12T12:00:00Z',
          financiero: { cargos: 4, facturado: 1234567.89, aplicado: 1000, saldo: 1233567.89 },
          academico: {
            regla: 'Clases dentro del alcance autorizado',
            clases: [
              {
                grupoMateriaId: 1,
                plantel: 'Plantel con un nombre extenso de prueba',
                grupo: 'Primero',
                materia: 'Matemáticas',
                inscritos: 20,
                participantesHistoricos: 20,
                inscritosVigentes: 20,
                oficialesCompletos: 0,
                promedioOficial: null,
                aprobados: 0,
                bajoReferencia: 0,
                entregasRecibidas: 0,
                entregasEsperadas: 20,
                entregasFaltantes: 20,
                parciales: [{ parcial: 1, capturados: 0, faltantes: 20, promedio: null }],
              },
            ],
          },
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
  for (const width of [320, 360, 768, 1024, 1440, 2560, 3840]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(baseUrl + '/analitica');
    await expect(page.getByText('Consulta los indicadores de tu institución')).toBeVisible();
    await page.getByRole('button', { name: 'Consultar indicadores' }).click();
    await expect(page.getByRole('heading', { name: 'Finanzas del ciclo' })).toBeVisible();
    const geometry = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      width: innerWidth,
      pairs: [...document.querySelectorAll('.analitica-kpis > div')].every(
        (el) =>
          el.querySelector('dt') &&
          el.querySelector('dd') &&
          Math.abs(
            el.querySelector('dt').getBoundingClientRect().x - el.querySelector('dd').getBoundingClientRect().x,
          ) < 1,
      ),
    }));
    if (geometry.scroll > geometry.width || !geometry.pairs)
      throw Error('Analytics layout ' + width + ': ' + JSON.stringify(geometry));
    const table = page.getByRole('region', { name: 'Seguimiento por clase' });
    await table.scrollIntoViewIfNeeded();
    await table.focus();
    if (width <= 800) {
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => table.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    }
    console.log('PASS analytics ' + width);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  const zoom = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
  if (zoom.scroll > zoom.width) throw Error('Text zoom overflow ' + JSON.stringify(zoom));
  console.log('PASS text size 200% at desktop');
  for (const width of [320, 1440, 3840]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(baseUrl);
    await expect(page.locator('.panel-bienvenida')).toBeVisible();
    if (width <= 800) await page.getByRole('button', { name: /Abrir menú/ }).click();
    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toHaveCount(1);
    const iconos = await page.evaluate(() =>
      [...document.querySelectorAll('.lateral nav svg')].map((svg) => ({
        hidden: svg.getAttribute('aria-hidden'),
        focusable: svg.getAttribute('focusable'),
        path: svg.querySelector('path')?.getBBox().width,
        width: svg.getBoundingClientRect().width,
        label: svg.parentElement.textContent.trim(),
      })),
    );
    if (
      iconos.length !== 16 ||
      iconos.some(
        (svg) => svg.hidden !== 'true' || svg.focusable !== 'false' || !svg.path || svg.width !== 20 || !svg.label,
      )
    )
      throw Error('Invalid navigation icon at ' + width);
    if (width <= 800) {
      const boton = page.getByRole('button', { name: /Cerrar menú/ });
      await expect(boton.locator('svg')).toBeVisible();
      const textSize = await boton.locator('span').evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
      if (textSize > 16) throw Error('Menu label inherits icon font size');
      await page.keyboard.press('Escape');
    }
    console.log('PASS navigation icons ' + width);
  }
  for (const [width, reducedMotion, forcedColors] of [
    [320, 'reduce', 'none'],
    [1440, 'no-preference', 'none'],
    [360, 'no-preference', 'active'],
  ]) {
    let liberarModulo;
    let moduloSolicitado = false;
    const moduloPendiente = new Promise((resolve) => {
      liberarModulo = resolve;
    });
    const rutaModulo = '**/src/pages/Analitica.tsx*';
    await page.route(rutaModulo, async (route) => {
      moduloSolicitado = true;
      await moduloPendiente;
      await route.continue();
    });
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion, forcedColors });
      await page.goto(baseUrl + '/analitica', { waitUntil: 'domcontentloaded' });
      await expect.poll(() => moduloSolicitado).toBe(true);
      const estado = page.getByRole('status', { name: 'Cargando contenido' });
      await expect(estado).toBeVisible();
      const geometria = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        width: innerWidth,
      }));
      if (geometria.scroll > geometria.width) throw Error('Skeleton overflow at ' + width);
      if (reducedMotion === 'reduce' || forcedColors === 'active') {
        await expect(estado.locator('.esqueleto-linea').first()).toHaveCSS('animation-name', 'none');
      }
      liberarModulo();
      await expect(page.getByRole('heading', { name: 'Analítica académica y financiera' })).toBeVisible();
      await expect(estado).toHaveCount(0);
      console.log('PASS skeleton ' + width + ' motion=' + reducedMotion + ' colors=' + forcedColors);
    } finally {
      liberarModulo();
      await page.unroute(rutaModulo);
    }
  }
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
