// Recorrido de apertura parcial y cuenta de personal compartida con API simulada.
const { chromium, expect } = require('@playwright/test');
const { spawn } = require('node:child_process');
const { resolve } = require('node:path');
const root = resolve(__dirname, '..'), base = 'http://127.0.0.1:5196';
const server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5196', '--strictPort'], { cwd: root, env: { ...process.env, VITE_API_URL: '/api' }, stdio: 'ignore' });
const pagina = datos => ({ datos, total: datos.length, pagina: 1, porPagina: 10 });
let browser;
(async () => {
  for (let n = 0; n < 100; n++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
  for (const width of [360, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errores = [], aperturas = [], reanudaciones = [], vinculos = [];
    let reanudada = false;
    page.on('pageerror', e => errores.push(e.message));
    await page.addInitScript(() => localStorage.setItem('escolar_recorrido_web_v2_1_SUPERADMIN', '1'));
    await page.route(u => u.pathname.startsWith('/api/'), async route => {
      const p = new URL(route.request().url()).pathname;
      let data = [];
      if (p.endsWith('/auth/refresh')) data = { accessToken: 'qa' };
      if (p.endsWith('/auth/me')) data = { id: 1, nombreCompleto: 'QA', roles: [{ clave: 'SUPERADMIN' }] };
      if (p.endsWith('/configuracion/marca')) data = { nombreInstitucion: 'Institución QA', colorPrimario: '#14343B', colorSecundario: '#C79A3C' };
      if (p.endsWith('/planteles/mios')) data = [{ id: 1, nombre: 'Centro QA' }];
      if (p.endsWith('/academico/ciclos')) data = [{ id: 1, clave: '2060', estado: 'PREPARACION', fechaInicio: '2060-01-01', fechaFin: '2060-12-31' }];
      if (p.endsWith('/finanzas/conceptos')) data = [{ id: 1, clave: 'INS', nombre: 'Inscripción', tipo: 'INSCRIPCION', montoBase: 100, activo: true }];
      if (/\/catalogos\/(niveles|carreras|periodos)$/.test(p)) data = pagina([{ id: 1, nombre: p.endsWith('/niveles') ? 'Secundaria' : 'Plan y periodo QA', versionPlan: 'QA', tipo: 'ANUAL', numero: 1 }]);
      if (p.endsWith('/cartera/alumnos-elegibles')) data = pagina([{ id: 8, matricula: 'QA8', usuario: { nombre: 'Ana', apellidoPaterno: 'Prueba' } }]);
      if (p.endsWith('/cartera/alumnos/8/resumen')) data = { aperturas: [], cargos: [], pagado: 0, saldo: 0 };
      if (p.endsWith('/cartera/integral/previsualizar')) { const d = route.request().postDataJSON(); data = { cotizacion: 'a'.repeat(64), total: d.total, conceptos: d.cuotas.map(c => ({ ...c, nombre: 'Inscripción' })) }; }
      if (p.endsWith('/cartera/integral/confirmar')) { aperturas.push(route.request().postDataJSON()); data = { id: 4, alumnoId: 8, estado: 'PAUSA', grupoId: null, total: 100, avisos: ['El alumno todavía no tiene grupo asignado.'] }; }
      if (p.endsWith('/cartera/4')) data = { id: 4, alumnoId: 8, nombreAlumno: 'Ana Prueba', matricula: 'QA8', estado: reanudada ? 'ABIERTA' : 'PAUSA', grupoId: reanudada ? 1 : null, total: 100, contexto: { plantelId: 1, cicloId: 1, nivelId: 1, turno: 'MATUTINO', ...(reanudada ? { carreraId: 1, periodoAcademicoId: 1 } : {}) }, avisos: [reanudada ? 'El grupo todavía no tiene materias asignadas.' : 'El alumno todavía no tiene grupo asignado.'], financiero: { aperturas: [], cargos: [], pagado: 0, saldo: 0 } };
      if (p.endsWith('/cartera/4/reanudar')) { reanudaciones.push(route.request().postDataJSON()); reanudada = true; data = { estado: 'ABIERTA', grupoId: 1 }; }
      if (p.endsWith('/academico/grupos')) data = pagina([]);
      if (p.endsWith('/usuarios/listado')) data = pagina([{ id: 12, nombre: 'Elena Prueba', correo: 'qa@example.invalid', roles: ['FINANZAS'], planteles: ['Centro QA'], activo: true }]);
      if (p.endsWith('/docentes/vincular-personal')) { vinculos.push(route.request().postDataJSON()); data = { id: 7, usuarioId: 12 }; }
      if (p.endsWith('/docentes')) data = pagina([]);
      await route.fulfill({ json: data });
    });
    await page.goto(base + '/apertura-cartera/nueva');
    await page.getByLabel('Tipo de apertura').selectOption('EXISTENTE');
    await page.getByLabel('Plantel', { exact: true }).selectOption('1');
    await page.getByLabel('Alumno sin cartera', { exact: true }).selectOption('8');
    await page.getByLabel('Ciclo', { exact: true }).selectOption('1');
    await page.getByLabel('Nivel académico', { exact: true }).selectOption('1');
    await expect(page.getByLabel('Asignación de grupo', { exact: true })).toHaveValue('AUTOMATICA');
    await page.getByLabel('Total contratado del periodo').fill('100');
    await page.getByLabel('Concepto', { exact: true }).selectOption('1');
    await page.getByLabel('Mes de cobro', { exact: true }).fill('2060-02');
    await page.getByLabel('Fecha de vencimiento', { exact: true }).fill('2060-02-05');
    await page.getByRole('button', { name: 'Previsualizar apertura', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar alumno y cartera', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Revisar pendientes de esta apertura' })).toBeVisible();
    expect(aperturas).toHaveLength(1);
    expect(aperturas[0]).toMatchObject({ nivelId: 1, asignacion: 'AUTOMATICA' });
    expect(aperturas[0]).not.toHaveProperty('carreraId'); expect(aperturas[0]).not.toHaveProperty('periodoAcademicoId');
    await page.getByRole('link', { name: 'Revisar pendientes de esta apertura' }).click();
    await expect(page.getByRole('button', { name: 'Revisar reanudación' })).toBeDisabled();
    await page.getByLabel('Carrera y plan pendientes', { exact: true }).selectOption('1');
    await page.getByLabel('Periodo académico pendiente', { exact: true }).selectOption('1');
    await page.getByLabel('Motivo de reanudación').fill('Completar contexto académico');
    await page.getByRole('button', { name: 'Revisar reanudación' }).click();
    await page.getByRole('button', { name: 'Reanudar cartera', exact: true }).click();
    await expect(page.getByText('El grupo todavía no tiene materias asignadas.', { exact: true })).toBeVisible();
    expect(reanudaciones[0]).toMatchObject({ carreraId: 1, periodoAcademicoId: 1 });
    expect(reanudaciones[0]).not.toHaveProperty('grupoId');
    await page.goto(base + '/docentes/nuevo');
    await page.getByLabel('La persona ya tiene una cuenta de personal').check();
    await page.getByLabel('Cuenta de personal', { exact: true }).selectOption('12');
    await page.getByLabel('Núm. empleado', { exact: true }).fill('DOC12');
    await page.getByLabel('Cédula pendiente de capturar').check();
    await page.getByRole('button', { name: 'Vincular expediente docente' }).click();
    await expect(page.getByText('Expediente docente vinculado. Se conservaron las demás funciones de la cuenta.', { exact: true })).toBeVisible();
    expect(vinculos).toEqual([{ usuarioId: 12, numEmpleado: 'DOC12', cedulaPendiente: true }]);
    expect(errores).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    console.log('PASS apertura con nivel, reanudación automática y personal docente ' + width);
    await page.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); server.kill(); });
