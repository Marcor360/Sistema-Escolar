// Recorrido de interfaz con API simulada. Las transacciones se prueban en integración real.
const { chromium, expect } = require('@playwright/test');
const { spawn } = require('node:child_process');
const { resolve } = require('node:path');
const root = resolve(__dirname, '..');
const base = 'http://127.0.0.1:5184';
const server = spawn(
  process.execPath,
  [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5184', '--strictPort'],
  { cwd: root, env: { ...process.env, VITE_API_URL: '/api' }, stdio: 'ignore' },
);
const paginar = (datos) => ({ datos, total: datos.length, pagina: 1, porPagina: 10 });
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
  for (const width of (process.env.CARTERA_WIDTHS || '360,768,1280,1920').split(',').map(Number)) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } }),
      errores = [],
      confirmaciones = [];
    let correo = false, reanudaciones = 0;
    page.on('pageerror', (e) => errores.push(e.message));
    await page.route(
      (u) => u.pathname.startsWith('/api/'),
      async (route) => {
        const req = route.request(),
          path = new URL(req.url()).pathname;
        let data = [];
        if (path.endsWith('/auth/refresh')) data = { accessToken: 'qa-cartera' };
        if (path.endsWith('/auth/me'))
          data = {
            id: 1,
            email: 'qa@example.invalid',
            nombreCompleto: 'Control Escolar QA',
            roles: [{ clave: 'SUPERADMIN' }],
          };
        if (path.endsWith('/configuracion/marca'))
          data = { nombreInstitucion: 'Institución QA', colorPrimario: '#003366', colorSecundario: '#d4af37' };
        if (path.endsWith('/planteles/mios')) data = [{ id: 1, nombre: 'Centro' }];
        if (path.endsWith('/academico/ciclos'))
          data = [{ id: 1, clave: '2057', estado: 'PREPARACION', fechaInicio: '2057-01-01', fechaFin: '2057-12-31' }];
        if (path.endsWith('/finanzas/conceptos'))
          data = [{ id: 1, clave: 'COL', nombre: 'Colegiatura', tipo: 'COLEGIATURA', montoBase: 100, activo: true }];
        if (/\/catalogos\/(niveles|carreras|periodos)$/.test(path))
          data = paginar([{ id: 1, nombre: 'Catálogo QA', versionPlan: '1', tipo: 'ANUAL', numero: 1 }]);
        if (path.endsWith('/cartera/alumnos/8/resumen'))
          data = {
            aperturas: [],
            cargos: [
              {
                id: 1,
                concepto: 'Colegiatura anterior',
                periodo: '2057-01',
                fechaVencimiento: '2057-01-05',
                pagado: 100,
                saldo: 0,
                estado: 'PAGADO',
              },
            ],
            pagado: 100,
            saldo: 0,
          };
        if (path.endsWith('/cartera/alumnos-elegibles'))
          data = paginar([{ id: 8, matricula: 'ANT8', usuario: { nombre: 'Alumno', apellidoPaterno: 'Existente' } }]);
        if (path.endsWith('/cartera/integral/previsualizar')) {
          const p = req.postDataJSON();
          data = {
            total: p.total,
            cotizacion: 'a'.repeat(64),
            conceptos: p.cuotas.map((c) => ({ ...c, nombre: 'Colegiatura' })),
          };
        }
        if (path.endsWith('/cartera/integral/confirmar')) {
          confirmaciones.push(req.postDataJSON());
          data = { id: 4, alumnoId: 9, estado: 'PAUSA', grupoId: null, total: 200 };
        }
        if (path.endsWith('/cartera')) data = paginar([{ id: 4, alumnoId: 9, matricula: 'NUEVO9', nombreAlumno: 'Alumno Nuevo', estado: 'PAUSA', grupoId: null, total: 200, conceptos: [{ nombre: 'Colegiatura', monto: 100 }, { nombre: 'Colegiatura', monto: 100 }] }]);
        if (path.endsWith('/cartera/4')) data = {
          id: 4, alumnoId: 9, matricula: 'NUEVO9', nombreAlumno: 'Alumno Nuevo', estado: 'PAUSA', grupoId: null, total: 200,
          contexto: { plantelId: 1, cicloId: 1, nivelId: 1, carreraId: 1, periodoAcademicoId: 1, turno: 'MATUTINO' },
          financiero: { aperturas: [{ id: 4, estado: 'PAUSA', total: 200, cuotas: [
            { nombre: 'Colegiatura febrero', periodo: '2057-02', fechaVencimiento: '2057-02-05', monto: 100 },
            { nombre: 'Colegiatura marzo', periodo: '2057-03', fechaVencimiento: '2057-03-05', monto: 100 },
          ] }], cargos: [], pagado: 0, saldo: 0 },
        };
        if (path.endsWith('/academico/grupos')) data = paginar([]);
        if (path.endsWith('/cartera/4/reanudar')) { reanudaciones++; data = { estado: 'PAUSA', grupoId: null }; }
        if (path.endsWith('/usuarios/listado'))
          data = paginar([
            {
              id: 9,
              usuarioId: 19,
              matricula: 'NUEVO9',
              nombre: 'Alumno Nuevo',
              correo: correo ? 'nuevo@example.invalid' : null,
              estatus: 'ACTIVO',
            },
          ]);
        if (path.endsWith('/usuarios/alumnos/9/correo-institucional')) {
          correo = true;
          data = { mensaje: 'Correo asignado. Activación solicitada.' };
        }
        await route.fulfill({ json: data });
      },
    );
    await page.goto(base + '/apertura-cartera/nueva');
    if (await page.getByRole('button', { name: 'Omitir recorrido' }).count())
      await page.getByRole('button', { name: 'Omitir recorrido' }).click();
    await page.getByLabel('Plantel', { exact: true }).selectOption('1');
    await page.getByLabel('Matrícula *', { exact: true }).fill('NUEVO9');
    await page.getByRole('button', { name: 'Volver a aperturas' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Volver a aperturas' })).toBeFocused();

    await page.getByLabel('Nombre *', { exact: true }).fill('Alumno');
    await page.getByLabel('Primer apellido *').fill('Nuevo');
    await page.getByLabel('Segundo apellido *').fill('Escolar');
    await page.getByLabel('CURP *').fill('AAAA010101HDFLRN09');
    await expect(page.getByLabel('Correo institucional', { exact: true })).toHaveCount(0);
    await page.getByLabel('Ciclo', { exact: true }).selectOption('1');
    await page.getByLabel('Nivel académico', { exact: true }).selectOption('1');
    await page.getByLabel('Carrera y plan', { exact: true }).selectOption('1');
    await page.getByLabel('Periodo académico', { exact: true }).selectOption('1');
    await page.getByLabel('Total contratado del periodo').fill('200');
    await page.getByLabel('Concepto', { exact: true }).selectOption('1');
    await page.getByLabel('Mes de cobro', { exact: true }).fill('2057-02');
    await page.getByLabel('Fecha de vencimiento', { exact: true }).fill('2057-02-05');
    await page.getByRole('button', { name: 'Agregar cuota' }).click();
    await page.getByLabel('Concepto', { exact: true }).nth(1).selectOption('1');
    await page.getByLabel('Mes de cobro', { exact: true }).nth(1).fill('2057-03');
    await page.getByLabel('Fecha de vencimiento', { exact: true }).nth(1).fill('2057-03-05');
    await expect(page.getByLabel('Total contratado del periodo')).toHaveValue('200');
    await expect(page.getByLabel('Importe', { exact: true }).nth(0)).toHaveValue('100');
    await expect(page.getByLabel('Importe', { exact: true }).nth(1)).toHaveValue('100');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const etiquetasDesalineadas = await page.locator('.formulario-cartera .campo > label').evaluateAll((ls) =>
      ls
        .filter((l) => {
          const control = l.nextElementSibling;
          return (
            control?.matches('input,select') &&
            l.getBoundingClientRect().bottom > control.getBoundingClientRect().top + 1
          );
        })
        .map((l) => l.textContent),
    );
    expect(etiquetasDesalineadas).toEqual([]);
    await page.getByRole('button', { name: 'Previsualizar apertura', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar alumno y cartera' }).click();
    await expect(page.getByRole('heading', { name: 'Pausa / baja temporal sin cobros' })).toBeVisible();
    expect(confirmaciones).toHaveLength(1);
    expect(confirmaciones[0].nuevoAlumno).not.toHaveProperty('email');
    expect(confirmaciones[0].nuevoAlumno.apellidoMaterno).toBe('Escolar');
    expect(confirmaciones[0].cuotas).toHaveLength(2);
    expect(confirmaciones[0].asignacion).toBe('PAUSA');
    await page.getByRole('link', { name: 'Consultar aperturas', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Revisar reanudación' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Ver cuotas y pagos de apertura #4' })).toBeVisible();
    if (await page.getByRole('button', { name: 'Omitir recorrido' }).count()) await page.getByRole('button', { name: 'Omitir recorrido' }).click();
    await page.getByRole('link', { name: 'Ver cuotas y pagos de apertura #4' }).click();
    await expect(page).toHaveURL(/apertura-cartera\/4/);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    await page.getByText('Cartera #4', { exact: true }).click();
    await expect(page.getByText('Colegiatura marzo', { exact: true })).toBeVisible();
    if (process.env.CARTERA_SCREENSHOTS) { require('node:fs').mkdirSync(process.env.CARTERA_SCREENSHOTS, { recursive: true }); await page.screenshot({ path: resolve(process.env.CARTERA_SCREENSHOTS, 'detalle-' + width + '.png'), fullPage: true }); }
    await page.getByLabel('Motivo de reanudación').fill('Incorporación autorizada de prueba');
    await page.getByRole('button', { name: 'Revisar reanudación' }).click();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    expect(reanudaciones).toBe(0);
    await expect(page.getByRole('button', { name: 'Revisar reanudación' })).toBeFocused();
    await page.getByRole('button', { name: 'Revisar reanudación' }).click();
    await page.getByRole('button', { name: 'Reanudar cartera', exact: true }).click();
    await expect(page.getByText('Continúa en pausa sin cargos: no se encontró grupo disponible.')).toBeVisible();
    expect(reanudaciones).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    expect(await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => v.id))).toEqual([]);
    await page.getByRole('link', { name: 'Volver a aperturas' }).click();
    await expect(page.getByRole('link', { name: 'Ver cuotas y pagos de apertura #4' })).toBeVisible();
    await page.goto(base + '/usuarios?vista=consulta');
    if (await page.getByRole('button', { name: /Consultar usuarios/ }).count())
      await page.getByRole('button', { name: /Consultar usuarios/ }).click();
    await expect(page.getByLabel('Mostrar alumnos sin correo institucional')).toBeVisible();
    if (await page.getByRole('button', { name: 'Omitir recorrido' }).count())
      await page.getByRole('button', { name: 'Omitir recorrido' }).click();
    await page.getByLabel('Mostrar alumnos sin correo institucional').check();
    const nombreCelda=page.locator('td[data-etiqueta="Nombre"]').filter({hasText:'Alumno Nuevo'});
    await expect(nombreCelda).toBeVisible();
    if(width<=700){
      const textoVisible=await nombreCelda.evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);const b=r.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth;});
      expect(textoVisible).toBe(true);
    }

    await page.getByRole('button', { name: 'Asignar correo institucional', exact: true }).click();
    await page.getByLabel('Correo institucional', { exact: true }).fill('nuevo@example.invalid');
    await page.getByRole('button', { name: 'Asignar correo y solicitar activación' }).click();
    await expect(page.getByText('Correo asignado. Activación solicitada.')).toBeVisible();
    await page.goto(base + '/apertura-cartera/nueva?modo=existente');
    await page.getByLabel('Plantel', { exact: true }).selectOption('1');
    await page.getByLabel('Alumno sin cartera', { exact: true }).selectOption('8');
    await expect(page.getByRole('heading', { name: 'Cartera y pagos registrados' })).toBeVisible();
    await expect(page.getByText(/Colegiatura anterior/)).toBeVisible();
    await expect(page.getByLabel('CURP *')).toHaveCount(0);
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const accesibilidad = await page.evaluate(async () => {
      const { violations } = await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      });
      return violations.map((v) => ({ id: v.id, impact: v.impact }));
    });
    expect(accesibilidad).toEqual([]);
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => {
      document.documentElement.style.zoom = '';
    });
    expect(errores).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    console.log('PASS alumno/cartera sin correo, cuotas, pausa y acceso posterior ' + width);
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
