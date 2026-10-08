import { spawn } from 'child_process';
import { resolve } from 'path';
import { strict as assert } from 'assert';
interface Datos { baseUrl: string; email: string; password: string; sufijo: string; plantelId: number; cicloId: number; materiaId: number; docenteId: number; conceptoId: number }
/** Navegador real + API real + DB migrada. Sin interceptar respuestas ni simular usuarios. */
export async function recorridoWeb(d: Datos, tipo: 'academico' | 'financiero') {
  const webRoot = resolve(process.cwd(), '../web');
  const { chromium, expect } = require(resolve(webRoot, 'node_modules/@playwright/test'));
  const server = spawn(process.execPath, [resolve(webRoot, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5181', '--strictPort'], { cwd: webRoot, env: { ...process.env, VITE_API_URL: d.baseUrl }, stdio: ['ignore', 'ignore', 'pipe'] });
  let errorServer = ''; server.stderr.on('data', (b: Buffer) => { errorServer += b.toString(); });
  let browser;
  try {
    let listo = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error(`Vite no inició: ${errorServer}`);
      try { if ((await fetch('http://127.0.0.1:5181')).ok) { listo = true; break; } } catch { /* inicio en curso */ }
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(listo, 'La web no inició'); browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
    const page = await browser.newPage(); const errores: string[] = [];
    page.on('pageerror', (e: Error) => errores.push(e.message)); page.on('dialog', (dialog: { accept: () => Promise<void> }) => { void dialog.accept(); });
    await page.addLocatorHandler(page.getByRole('dialog', { name: 'Confirmar operación', exact: true }), async () => { await page.getByRole('dialog', { name: 'Confirmar operación', exact: true }).getByRole('button', { name: 'Confirmar', exact: true }).click(); });
    await page.goto('http://127.0.0.1:5181/login'); await page.getByLabel('Correo institucional').fill(d.email); await page.getByLabel('Contraseña', { exact: true }).fill(d.password); await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('link', { name: 'Alumnos', exact: true })).toBeVisible();
    const matricula = `BW${tipo === 'academico' ? 'A' : 'F'}${d.sufijo}`;
    await page.getByRole('link', { name: 'Alumnos', exact: true }).click();
    const form = page.locator('#form-alumno'); await form.getByLabel('Plantel', { exact: true }).selectOption(String(d.plantelId));
    await form.getByLabel('Matrícula').fill(matricula); await form.getByLabel('Nombre', { exact: true }).fill('Navegador'); await form.getByLabel('Apellido paterno').fill(tipo);
    await form.getByLabel('Correo', { exact: true }).fill(`${matricula}@example.invalid`); await form.getByLabel('Contraseña inicial').fill('Integracion_Segura_42!'); await form.getByRole('button', { name: 'Guardar alumno' }).click();
    await expect(page.getByText(`Alumno ${matricula} registrado`, { exact: false })).toBeVisible();
    let fila = page.locator('tr').filter({ hasText: matricula }); await expect(fila).toBeVisible();
    if (tipo === 'academico') {
      await fila.getByRole('button', { name: 'Editar', exact: true }).click(); await expect(form.getByRole('heading', { name: 'Editar alumno' })).toBeVisible(); await form.getByLabel('Nombre', { exact: true }).fill('Corregido'); await form.getByRole('button', { name: 'Guardar alumno' }).click(); await expect(fila).toContainText('Corregido');
      await page.getByRole('link', { name: 'Grupos', exact: true }).click(); const grupo = `Web-${d.sufijo}`;
      const crear = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Nuevo grupo', exact: true }) });
      await crear.getByLabel('Plantel', { exact: true }).selectOption(String(d.plantelId)); await crear.getByLabel('Ciclo', { exact: true }).selectOption(String(d.cicloId)); await crear.getByLabel('Nombre', { exact: true }).fill(grupo); await crear.getByRole('button', { name: 'Crear grupo', exact: true }).click();
      await page.locator('tr').filter({ hasText: grupo }).getByRole('button', { name: 'Administrar' }).click();
      const materias = page.locator('section').filter({ has: page.getByRole('heading', { name: new RegExp(`Materias del grupo ${grupo}`) }) });
      await materias.getByLabel('Materia', { exact: true }).selectOption(String(d.materiaId)); await expect(materias.getByLabel('Docente', { exact: true }).locator(`option[value="${d.docenteId}"]`)).toBeAttached(); await materias.getByLabel('Docente', { exact: true }).selectOption(String(d.docenteId)); await materias.getByRole('button', { name: 'Asignar materia' }).click(); await expect(materias.locator('tbody tr')).toHaveCount(1);
      const alumnos = page.locator('section').filter({ has: page.getByRole('heading', { name: `Alumnos inscritos en ${grupo}` }) });
      await alumnos.getByLabel('Buscar alumno').fill(matricula); await expect(alumnos.getByLabel('Alumno', { exact: true }).locator('option').filter({ hasText: matricula })).toBeAttached(); await alumnos.getByLabel('Alumno', { exact: true }).selectOption({ label: await alumnos.getByLabel('Alumno', { exact: true }).locator('option').filter({ hasText: matricula }).innerText() }); await alumnos.getByRole('button', { name: 'Inscribir', exact: true }).click(); await expect(alumnos.locator('tbody tr')).toHaveCount(1);
      await alumnos.getByRole('button', { name: 'Dar de baja inscripción' }).click(); await expect(alumnos.locator('tbody tr').filter({ hasText: matricula })).toHaveCount(0);
      await alumnos.getByLabel('Alumno', { exact: true }).selectOption({ label: await alumnos.getByLabel('Alumno', { exact: true }).locator('option').filter({ hasText: matricula }).innerText() }); await alumnos.getByRole('button', { name: 'Inscribir', exact: true }).click(); await expect(alumnos.locator('tbody tr').filter({ hasText: matricula })).toHaveCount(1);
      await page.getByRole('link', { name: 'Alumnos', exact: true }).click(); fila = page.locator('tr').filter({ hasText: matricula }); await fila.getByRole('button', { name: 'Historial y boleta' }).click(); await page.getByRole('button', { name: 'Ver calificaciones', exact: true }).click(); await expect(page.getByText('Sin calificaciones en esta inscripción.', { exact: false })).toBeVisible();
      const pdf = page.waitForResponse((r: { url: () => string }) => r.url().includes('/reportes/boleta/')); await page.getByRole('button', { name: 'Boleta de esta inscripción' }).click(); const respuesta = await pdf; assert.equal(respuesta.status(), 200); assert((await respuesta.body()).subarray(0,4).toString() === '%PDF');
    } else {
      await page.getByRole('link', { name: 'Finanzas', exact: true }).click();
      const crear = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Nuevo cargo individual', exact: true }) });
      await crear.getByLabel('Buscar alumno').fill(matricula); await expect(crear.getByLabel('Alumno', { exact: true }).locator('option').filter({ hasText: matricula })).toBeAttached(); await crear.getByLabel('Alumno', { exact: true }).selectOption({ label: await crear.getByLabel('Alumno', { exact: true }).locator('option').filter({ hasText: matricula }).innerText() }); await crear.getByLabel('Concepto', { exact: true }).selectOption(String(d.conceptoId)); await crear.getByLabel('Descripción').fill(`Error corregible ${d.sufijo}`); await crear.getByLabel('Monto', { exact: true }).fill('100'); await crear.getByRole('button', { name: 'Registrar cargo' }).click();
      const cargo = page.locator('tr').filter({ hasText: `Error corregible ${d.sufijo}` }); await cargo.getByRole('button', { name: 'Cancelar cargo' }).click(); await page.getByRole('dialog').getByLabel('Motivo').fill('Error de captura corregido'); await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click(); await expect(cargo).toContainText('CANCELADO');
      await crear.getByLabel('Buscar alumno').fill(matricula); await crear.getByLabel('Alumno', { exact: true }).selectOption({ label: await crear.getByLabel('Alumno', { exact: true }).locator('option').filter({ hasText: matricula }).innerText() }); await crear.getByLabel('Concepto', { exact: true }).selectOption(String(d.conceptoId)); await crear.getByLabel('Descripción').fill(`Pago corregible ${d.sufijo}`); await crear.getByLabel('Monto', { exact: true }).fill('100'); await crear.getByRole('button', { name: 'Registrar cargo' }).click();
      await page.getByRole('tab', { name: 'Pagos', exact: true }).click(); const pago = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Registrar pago manual', exact: true }) });
      await pago.getByLabel('Buscar alumno').fill(matricula); await expect(pago.getByLabel('Alumno', { exact: true }).locator('option').filter({ hasText: matricula })).toBeAttached(); await pago.getByLabel('Alumno', { exact: true }).selectOption({ label: await pago.getByLabel('Alumno', { exact: true }).locator('option').filter({ hasText: matricula }).innerText() }); await expect(pago.getByLabel('Cargo', { exact: true }).locator('option').filter({ hasText: `Pago corregible ${d.sufijo}` })).toBeAttached(); await pago.getByLabel('Cargo', { exact: true }).selectOption({ label: await pago.getByLabel('Cargo', { exact: true }).locator('option').filter({ hasText: `Pago corregible ${d.sufijo}` }).innerText() }); await pago.getByLabel('Monto', { exact: true }).fill('25'); await pago.getByRole('button', { name: 'Registrar pago', exact: true }).click();
      const registro = page.locator('tr').filter({ hasText: matricula }); await registro.getByRole('button', { name: 'Anular pago' }).click(); await page.getByRole('dialog').getByLabel('Motivo').fill('Corrección de importe'); await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click(); await expect(registro).toContainText('CANCELADO');
    }
    assert.deepEqual(errores, [], 'Errores JavaScript en el recorrido'); await page.reload(); await expect(page.getByRole('link', { name: 'Alumnos', exact: true })).toBeVisible();
  } finally { if (browser) await browser.close(); server.kill('SIGTERM'); await new Promise<void>((r) => { if (server.exitCode !== null) r(); else server.once('exit', () => r()); }); }
}
