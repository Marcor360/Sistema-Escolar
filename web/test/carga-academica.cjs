const { chromium, expect } = require('@playwright/test');
const { spawn } = require('node:child_process');
const { resolve } = require('node:path');
const root = resolve(__dirname, '..');
const url = 'http://127.0.0.1:5193';
const server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5193', '--strictPort'], { cwd: root, env: { ...process.env, VITE_API_URL: '/api' }, stdio: 'ignore' });
let browser;
(async () => {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) break; } catch { /* Arranque local. */ }
    if (server.exitCode !== null) throw Error('Vite no inició');
    await new Promise(r => setTimeout(r, 200));
  }
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
  for (const width of [360, 768, 1280, 1920]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.setDefaultTimeout(5000);
    const errores = [], escrituras = [];
    page.on('pageerror', e => errores.push(e.message));
    const grupo = { id: 1, nombre: 'Grupo QA', ciclo: { id: 1, clave: 'QA2026', estado: 'PREPARACION', activo: false }, plantel: { id: 1, nombre: 'Plantel QA' } };
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const p = new URL(route.request().url()).pathname;
      if (route.request().method() !== 'GET') escrituras.push(p);
      let data = [];
      if (p.endsWith('/auth/refresh')) data = { accessToken: 'qa' };
      if (p.endsWith('/auth/me')) data = { id: 1, nombreCompleto: 'Personal QA', roles: [{ clave: 'SUPERADMIN' }] };
      if (p.endsWith('/academico/ciclos')) data = [grupo.ciclo];
      if (p.endsWith('/planteles/mios')) data = [grupo.plantel];
      if (p.endsWith('/academico/materias')) data = [{ id: 1, clave: 'MAT', nombre: 'Matemáticas QA' }, { id: 2, clave: 'COM', nombre: 'Comunicación QA' }];
      if (p.endsWith('/academico/grupos')) data = { datos: [grupo], pagina: 1, porPagina: 10, total: 1 };
      if (p.endsWith('/academico/grupos/1')) data = grupo;
      if (p.endsWith('/academico/grupos/1/materias')) data = [{ id: 1, materia: { id: 1, clave: 'MAT', nombre: 'Matemáticas QA' }, docente: null }];
      await route.fulfill({ json: data });
    });
    await page.goto(url + '/operaciones');
    const omitir = page.getByRole('button', { name: 'Omitir recorrido', exact: true });
    await omitir.waitFor();
    await page.getByRole('button', { name: /Cargar materias, grupos y alumnos/ }).click();
    await expect(page.getByLabel('Ir a un paso')).toBeVisible();
    await page.getByRole('button', { name: 'Reducir guía', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Guía pausada' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuar guía', exact: true }).click();
    await page.getByRole('button', { name: 'Cambiar de área', exact: true }).click();
    await page.getByRole('button', { name: /Mi cuenta, avisos y seguridad/ }).click();
    await expect(page).toHaveURL(/seguimiento\?seccion=preferencias/);
    await expect(page.getByRole('navigation', { name: 'Herramientas de seguimiento' })).toBeVisible();
    await omitir.click();
    await page.goto(url + '/operaciones');
    try { await page.getByRole('button', { name: /Preparar carga académica/ }).click(); } catch(e) { console.log(page.url(), await page.locator('body').innerText(), errores); throw e; }
    await expect(page.getByRole('heading', { name: 'Carga académica, paso a paso' })).toBeVisible();
    expect(await page.locator('.ruta-carga-pasos > li').count()).toBe(6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('link', { name: 'Registrar materia', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Guardar materia', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Ver el orden de carga: materias, grupos y alumnos' }).click();
    await page.getByRole('link', { name: 'Consultar grupos y asignar materias' }).click();
    await page.getByRole('button', { name: 'Administrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Materias del grupo Grupo QA/ })).toBeVisible();
    await expect(page.getByLabel('Materia', { exact: true }).locator('option[value="1"]')).toHaveCount(0);
    await expect(page.getByLabel('Materia', { exact: true }).locator('option[value="2"]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Volver a opciones', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Materias del grupo/ })).toHaveCount(0);
    expect(escrituras.filter(p => !['/api/auth/refresh', '/api/auth/actividad'].includes(p))).toEqual([]);
    expect(errores).toEqual([]);
    console.log('PASS carga académica ' + width);
    await page.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); server.kill('SIGTERM'); });
