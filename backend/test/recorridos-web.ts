import { spawn } from 'child_process';
import { resolve } from 'path';
import { strict as assert } from 'assert';
interface Datos { baseUrl: string; email: string; password: string; sufijo: string; plantelId: number; cicloId: number; materiaId: number; docenteId: number; docenteEmail: string; docentePassword: string; conceptoId: number }
/** Navegador real + API real + DB migrada. Sin interceptar respuestas ni simular usuarios. */
export async function recorridoWeb(d: Datos, tipo: 'academico' | 'financiero' | 'altas') {
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
    // Cada recorrido representa un cliente distinto tras el proxy local; conserva el throttling real por IP.
    const ipCliente = tipo === 'academico' ? '203.0.113.1' : tipo === 'financiero' ? '203.0.113.2' : '203.0.113.3';
    const page = await browser.newPage({ extraHTTPHeaders: { 'x-forwarded-for': ipCliente } }); const errores: string[] = [];
    page.on('pageerror', (e: Error) => errores.push(e.message)); page.on('dialog', (dialog: { accept: () => Promise<void> }) => { void dialog.accept(); });
    await page.addLocatorHandler(page.getByRole('dialog', { name: 'Confirmar operación', exact: true }), async () => { await page.getByRole('dialog', { name: 'Confirmar operación', exact: true }).getByRole('button', { name: 'Confirmar', exact: true }).click(); });
    await page.goto('http://127.0.0.1:5181/login'); await page.getByLabel('Correo institucional').fill(d.email); await page.getByLabel('Contraseña', { exact: true }).fill(d.password); const respuestaLogin = page.waitForResponse((r: { url: () => string; request: () => { method: () => string } }) => r.url().endsWith('/auth/login') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Entrar' }).click();
    const login = await respuestaLogin;
    assert.equal(login.status(), 201, `Login del recorrido ${tipo}: ${await login.text()}`);
    await expect(page.getByRole('link', { name: 'Alumnos', exact: true })).toBeVisible();
    const bienvenida = page.locator('dialog.recorrido-dialogo');
    if (await bienvenida.count()) {
      while (await bienvenida.getByRole('button', { name: 'Siguiente' }).count()) {
        await bienvenida.getByRole('button', { name: 'Siguiente' }).click();
      }
      await bienvenida.getByRole('button', { name: 'Finalizar' }).click();
    }
    const matricula = `BW${tipo === 'academico' ? 'A' : tipo === 'financiero' ? 'F' : 'U'}${d.sufijo}`;
    await page.getByRole('link', { name: 'Alumnos', exact: true }).click();
    await page.getByRole('button',{name:/Registrar alumno/}).click();
    const form = page.locator('#form-alumno'); await form.getByLabel('Plantel *', { exact: true }).selectOption(String(d.plantelId));
    await form.getByLabel('Matrícula *', { exact: true }).fill(matricula); await form.getByLabel('Nombre *', { exact: true }).fill('Navegador'); await form.getByLabel('Primer apellido').fill(tipo);
    const plantelNombre = await form.getByLabel('Plantel *', { exact: true }).locator(`option[value="${d.plantelId}"]`).innerText();
    await form.getByLabel('Segundo apellido').fill('Institucional'); await form.getByLabel('Teléfono del alumno', { exact: true }).fill('5550001111'); await form.getByLabel('Fecha de nacimiento').fill('2009-01-02'); await form.getByLabel('Dirección').fill('Calle escolar 12');
    await expect(form.getByLabel('Contraseña inicial')).toHaveCount(0);
    await form.getByLabel('CURP').fill('GODE561231HDFRRN09');
    await form.getByLabel('Correo institucional *', { exact: true }).fill(`${matricula}@example.invalid`); await form.getByRole('button', { name: 'Registrar alumno', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: `Expediente de ${matricula} registrado.` })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continuar con apertura de cartera', exact: true })).toBeVisible();
    let fila = page.locator('tr').filter({ hasText: matricula }); await expect(fila).toBeVisible();
    if (tipo === 'academico') {
      await fila.getByRole('button', { name: 'Editar', exact: true }).click(); await expect(form.getByRole('heading', { name: 'Editar expediente' })).toBeVisible(); await form.getByLabel('Nombre *', { exact: true }).fill('Corregido'); await form.getByRole('button', { name: 'Guardar cambios' }).click(); await expect(fila).toContainText('Corregido');
      await page.getByRole('link', { name: 'Grupos', exact: true }).click(); await page.getByRole('button',{name:/Registrar grupo/}).click(); const grupo = `Web-${d.sufijo}`;
      const crear = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Nuevo grupo', exact: true }) });
      await crear.getByLabel('Plantel', { exact: true }).selectOption(String(d.plantelId)); await crear.getByLabel('Ciclo', { exact: true }).selectOption(String(d.cicloId)); await crear.getByLabel('Nombre', { exact: true }).fill(grupo); await crear.getByRole('button', { name: 'Crear grupo', exact: true }).click();
      await page.locator('tr').filter({ hasText: grupo }).getByRole('button', { name: 'Administrar' }).click();
      const materias = page.locator('section').filter({ has: page.getByRole('heading', { name: new RegExp(`Materias del grupo ${grupo}`) }) });
      await materias.getByLabel('Materia', { exact: true }).selectOption(String(d.materiaId)); await expect(materias.getByLabel('Docente', { exact: true }).locator(`option[value="${d.docenteId}"]`)).toBeAttached(); await materias.getByLabel('Docente', { exact: true }).selectOption(String(d.docenteId)); await materias.getByRole('button', { name: 'Asignar materia' }).click(); await expect(materias.locator('tbody tr')).toHaveCount(1);
      const alumnos = page.locator('section').filter({ has: page.getByRole('heading', { name: `Alumnos inscritos en ${grupo}` }) });
      await alumnos.getByLabel('Buscar alumno').fill(matricula); await expect(alumnos.getByLabel('Alumno', { exact: true }).locator('option').filter({ hasText: matricula })).toBeAttached(); await alumnos.getByLabel('Alumno', { exact: true }).selectOption({ label: await alumnos.getByLabel('Alumno', { exact: true }).locator('option').filter({ hasText: matricula }).innerText() }); await alumnos.getByRole('button', { name: 'Corrección académica sin cargos', exact: true }).click(); await expect(alumnos.locator('tbody tr')).toHaveCount(1);
      await alumnos.getByRole('button', { name: 'Dar de baja inscripción' }).click(); await expect(alumnos.locator('tbody tr').filter({ hasText: matricula })).toHaveCount(0);
      await alumnos.getByLabel('Alumno', { exact: true }).selectOption({ label: await alumnos.getByLabel('Alumno', { exact: true }).locator('option').filter({ hasText: matricula }).innerText() }); await alumnos.getByRole('button', { name: 'Corrección académica sin cargos', exact: true }).click(); await expect(alumnos.locator('tbody tr').filter({ hasText: matricula })).toHaveCount(1);
      await page.getByRole('link', { name: 'Calificaciones', exact: true }).click(); await page.getByRole('button',{name:/Capturar calificaciones/}).click(); await page.getByLabel('Buscar clase').fill(grupo);
      const selector = page.getByLabel('Clase', { exact: true }); await expect(selector.locator('option').filter({ hasText: grupo })).toBeAttached(); await selector.selectOption({ label: await selector.locator('option').filter({ hasText: grupo }).innerText() });
      await page.getByRole('button',{ name: 'Cargar lista' }).click(); await page.getByLabel(`Calificación de ${matricula.toUpperCase()}`).fill('80.25'); await page.getByRole('button',{ name: 'Guardar calificaciones' }).click(); await expect(page.getByText('1 calificaciones guardadas',{ exact: true })).toBeVisible();
      await page.getByRole('button',{ name: 'Guardar calificaciones' }).click(); await expect(page.getByText('No hay cambios que guardar.',{ exact: true })).toBeVisible();
      await page.getByLabel(`Calificación de ${matricula.toUpperCase()}`).fill('90.25'); await page.getByLabel('Motivo obligatorio al corregir una nota existente').fill('Corrección autorizada desde navegador'); await page.getByRole('button',{ name: 'Guardar calificaciones' }).click(); await expect(page.getByText('1 calificaciones guardadas',{ exact: true })).toBeVisible();
      await page.getByRole('button',{ name: 'Cerrar periodo' }).click(); await expect(page.getByRole('button',{ name: 'Reabrir periodo' })).toBeVisible(); await expect(page.getByLabel(`Calificación de ${matricula.toUpperCase()}`)).toBeDisabled();
      await page.getByRole('button',{ name: 'Reabrir periodo' }).click(); await expect(page.getByLabel(`Calificación de ${matricula.toUpperCase()}`)).toBeEnabled();
      const xlsx = page.waitForResponse((r: { url: () => string }) => r.url().includes('/calificaciones.xlsx')); await page.getByRole('button',{ name: 'Descargar Excel' }).click(); assert.equal((await xlsx).status(),200);
      const claseImportacion = await selector.inputValue();
      const alumnoImportacion = (await page.getByLabel(`Calificación de ${matricula.toUpperCase()}`).getAttribute('id')).replace('nota-', '');
      await page.getByRole('button',{name:'Importar esta evaluación',exact:true}).click();
      const importacion = page.getByRole('region', { name: 'Importación de calificaciones', exact: true });
      await importacion.getByLabel('Motivo si corrige notas existentes').fill('Corrección en lote desde navegador');
      await importacion.getByLabel('Archivo de calificaciones').setInputFiles({ name: 'notas.csv', mimeType: 'text/csv', buffer: Buffer.from(`grupoMateriaId,parcial,alumnoId,matricula,grado,calificacion\n${claseImportacion},1,${alumnoImportacion},${matricula.toUpperCase()},,91.25`) });
      await importacion.getByRole('button', { name: 'Previsualizar sin guardar' }).click();
      await expect(importacion.getByText('1 filas; 1 cambios; 0 sin cambios.')).toBeVisible();
      await importacion.getByRole('button', { name: 'Confirmar importación', exact: true }).click();
      await expect(importacion.getByText('1 notas importadas; 0 sin cambios.')).toBeVisible();
      await page.getByRole('button',{name:'Capturar esta evaluación',exact:true}).click();
      await expect(page.getByLabel(`Calificación de ${matricula.toUpperCase()}`)).toHaveValue('91.25');
      await page.getByRole('button',{name:'Cancelar y volver a consulta',exact:true}).click();
      await page.getByRole('link', { name: 'Alumnos', exact: true }).click(); await page.getByRole('button',{name:/Consultar alumnos/}).click(); fila = page.locator('tr').filter({ hasText: matricula }); await fila.getByRole('button', { name: 'Historial y boleta' }).click(); await page.getByRole('button', { name: 'Ver calificaciones', exact: true }).click(); await expect(page.getByText('91.25',{ exact: true }).first()).toBeVisible();
      const pdf = page.waitForResponse((r: { url: () => string }) => r.url().includes('/reportes/boleta/')); await page.getByRole('button', { name: 'Boleta de esta inscripción' }).click(); const respuesta = await pdf; assert.equal(respuesta.status(), 200); assert((await respuesta.body()).subarray(0,4).toString() === '%PDF');
      await page.getByRole('link', {name:'Temarios',exact:true}).click(); await page.getByRole('button',{name:/Crear tema/}).click();
      await page.getByLabel('Buscar clase del temario').fill(grupo); const claseTema=page.getByLabel('Clase del temario',{exact:true}); await expect(claseTema.locator('option').filter({hasText:grupo})).toBeAttached(); await claseTema.selectOption(claseImportacion);
      await page.getByLabel('Título',{exact:true}).fill('Unidad del navegador'); await page.getByLabel('Contenido del tema (texto)').fill('Temario independiente sin alterar las notas'); await page.getByLabel('Publicación',{exact:true}).selectOption('PUBLICADO'); await page.getByRole('button',{name:'Guardar tema',exact:true}).click();
      await expect(page.getByRole('button',{name:'Agregar adjunto',exact:true})).toBeVisible(); await page.getByRole('button',{name:'Agregar adjunto',exact:true}).click(); await page.getByLabel('Archivo privado').setInputFiles({name:'tema.txt',mimeType:'text/plain',buffer:Buffer.from('Adjunto del temario')}); await page.getByRole('button',{name:'Adjuntar archivo',exact:true}).click(); await expect(page.getByRole('button',{name:/tema.txt/}).first()).toBeVisible();
      await page.getByRole('button',{name:'Consultar historial del tema',exact:true}).click(); await expect(page.getByText(/Revisión 2/)).toBeVisible();
      await page.getByRole('button',{name:'Cancelar tema',exact:true}).click(); await page.getByRole('dialog').getByLabel('Motivo',{exact:true}).fill('Contenido sustituido conservando revisiones'); await page.getByRole('dialog').getByRole('button',{name:'Confirmar',exact:true}).click(); await expect(page.getByText(/CANCELADO/).first()).toBeVisible();
      await page.goto('http://127.0.0.1:5181/ciclos/'+d.cicloId); await expect(page.getByRole('heading',{name:'Asignaturas y docentes',exact:true})).toBeVisible();
      // Mis clases es una ruta de MAESTRO: usar el docente realmente asignado, sin ampliar permisos administrativos.
      {
      const page = await browser.newPage({ extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.4' } });
      page.on('pageerror', (e: Error) => errores.push(e.message)); page.on('dialog', (dialog: { accept: () => Promise<void> }) => { void dialog.accept(); });
      await page.goto('http://127.0.0.1:5181/login'); await page.getByLabel('Correo institucional').fill(d.docenteEmail); await page.getByLabel('Contraseña', { exact: true }).fill(d.docentePassword); await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await expect(page.getByRole('link', { name: 'Mis clases', exact: true })).toBeVisible(); const bienvenidaDocente = page.locator('dialog.recorrido-dialogo'); await expect(bienvenidaDocente).toBeVisible();
      while (await bienvenidaDocente.getByRole('button', { name: 'Siguiente' }).count()) {
        await bienvenidaDocente.getByRole('button', { name: 'Siguiente' }).click();
      }
      await bienvenidaDocente.getByRole('button', { name: 'Finalizar' }).click();
      await page.goto('http://127.0.0.1:5181/maestro?vista=clase&clase='+claseImportacion); await page.getByRole('button',{name:'Crear actividad',exact:true}).click(); await page.getByLabel('Título',{exact:true}).fill('Actividad enfocada de navegador'); await page.getByRole('button',{name:'Crear actividad',exact:true}).click(); await expect(page.getByRole('heading',{name:'Actividad enfocada de navegador',exact:true})).toBeVisible();
      await page.getByRole('button',{name:'Editar actividad Actividad enfocada de navegador',exact:true}).click(); await page.getByLabel('Descripción',{exact:true}).fill('Texto corregido'); await page.getByRole('button',{name:'Guardar corrección',exact:true}).click(); await expect(page.getByRole('heading',{name:'Actividad enfocada de navegador',exact:true})).toBeVisible();
      await page.getByRole('button',{name:'Entregas de Actividad enfocada de navegador',exact:true}).click(); await expect(page.getByText('Sin registros para esta consulta.',{exact:true})).toBeVisible(); await page.getByRole('button',{name:'Volver a operaciones de la clase',exact:true}).click();
      await page.getByRole('button',{name:'Subir material',exact:true}).click(); await page.getByLabel('Título del material',{exact:true}).fill('Material enfocado de navegador'); await page.getByLabel('Archivo privado del material').setInputFiles({name:'material.txt',mimeType:'text/plain',buffer:Buffer.from('Material privado')}); await page.getByRole('button',{name:'Subir material',exact:true}).click(); await expect(page.getByRole('heading',{name:'Material enfocado de navegador',exact:true})).toBeVisible();
      await page.getByRole('button',{name:'Editar título de Material enfocado de navegador',exact:true}).click(); await page.getByLabel('Título del material',{exact:true}).fill('Material corregido'); await page.getByRole('button',{name:'Guardar título',exact:true}).click(); await expect(page.getByRole('heading',{name:'Material corregido',exact:true})).toBeVisible();
      await page.close();
      }


    } else if (tipo === 'financiero') {
      await page.getByRole('link', { name: 'Finanzas', exact: true }).click(); await page.getByRole('button',{name:/Asignar cargos adicionales/}).click();
      const crear = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Asignar cargo adicional', exact: true }) });
      await crear.getByLabel('Buscar alumno').fill(matricula); await expect(crear.getByLabel('Alumno', { exact: true }).locator('option').filter({ hasText: matricula })).toBeAttached(); await crear.getByLabel('Alumno', { exact: true }).selectOption({ label: await crear.getByLabel('Alumno', { exact: true }).locator('option').filter({ hasText: matricula }).innerText() }); await crear.getByLabel('Concepto', { exact: true }).selectOption(String(d.conceptoId)); await crear.getByLabel('Descripción').fill(`Error corregible ${d.sufijo}`); await crear.getByLabel('Monto', { exact: true }).fill('100'); await crear.getByRole('button', { name: 'Asignar cargo' }).click();
      const cargo = page.locator('tr').filter({ hasText: `Error corregible ${d.sufijo}` }); await cargo.getByRole('button', { name: 'Cancelar cargo' }).click(); await page.getByRole('dialog').getByLabel('Motivo').fill('Error de captura corregido'); await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click(); await expect(cargo).toContainText('CANCELADO');
      await page.getByRole('button',{name:'Volver a opciones',exact:true}).click(); await page.getByRole('button',{name:/Asignar cargos adicionales/}).click();
      await crear.getByLabel('Buscar alumno').fill(matricula); await crear.getByLabel('Alumno', { exact: true }).selectOption({ label: await crear.getByLabel('Alumno', { exact: true }).locator('option').filter({ hasText: matricula }).innerText() }); await crear.getByLabel('Concepto', { exact: true }).selectOption(String(d.conceptoId)); await crear.getByLabel('Descripción').fill(`Pago corregible ${d.sufijo}`); await crear.getByLabel('Monto', { exact: true }).fill('100'); await crear.getByRole('button', { name: 'Asignar cargo' }).click();
      await page.getByRole('button',{name:'Volver a opciones',exact:true}).click(); await page.getByRole('button',{name:/Registrar pago/}).click(); const pago = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Registrar pago manual', exact: true }) });
      await pago.getByLabel('Buscar alumno').fill(matricula); await expect(pago.getByLabel('Alumno', { exact: true }).locator('option').filter({ hasText: matricula })).toBeAttached(); await pago.getByLabel('Alumno', { exact: true }).selectOption({ label: await pago.getByLabel('Alumno', { exact: true }).locator('option').filter({ hasText: matricula }).innerText() }); await expect(pago.getByLabel('Cargo', { exact: true }).locator('option').filter({ hasText: `Pago corregible ${d.sufijo}` })).toBeAttached(); await pago.getByLabel('Cargo', { exact: true }).selectOption({ label: await pago.getByLabel('Cargo', { exact: true }).locator('option').filter({ hasText: `Pago corregible ${d.sufijo}` }).innerText() }); await pago.getByLabel('Monto', { exact: true }).fill('25'); await pago.getByRole('button', { name: 'Registrar pago', exact: true }).click();
      const registro = page.locator('tr').filter({ hasText: matricula }); await registro.getByRole('button', { name: 'Anular pago' }).click(); await page.getByRole('dialog').getByLabel('Motivo').fill('Corrección de importe'); await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click(); await expect(registro).toContainText('CANCELADO');
    } else {
      await fila.getByRole('button',{ name: 'Editar',exact: true }).click(); await expect(form.getByLabel('Fecha de nacimiento')).toHaveValue('2009-01-02'); await expect(form.getByLabel('Dirección')).toHaveValue('Calle escolar 12'); await form.getByLabel('Teléfono del alumno',{ exact: true }).fill(''); await form.getByRole('button',{ name: 'Guardar cambios' }).click();
      await page.getByRole('link',{ name: 'Docentes',exact: true }).click();
      await page.getByRole('button', { name: /Registrar docente/ }).click();
      await expect(page).toHaveURL(/\/docentes\/nuevo$/);
      await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toHaveCount(0);
      const docenteForm = page.locator('#form-docente'), empleado = `WEBU${d.sufijo}`;
      await docenteForm.getByLabel('Núm. empleado').fill(empleado); await docenteForm.getByLabel('Nombre',{ exact: true }).fill('Docente'); await docenteForm.getByLabel('Primer apellido').fill('Institucional'); await docenteForm.getByLabel('Segundo apellido').fill('Materno'); await docenteForm.getByLabel('Teléfono',{ exact: true }).fill('5550002222'); await docenteForm.getByLabel('Cédula profesional').fill('CED123456'); await docenteForm.getByLabel('Correo',{ exact: true }).fill(`${empleado}@example.invalid`); await expect(docenteForm.getByLabel('Contraseña inicial')).toHaveCount(0); await docenteForm.getByLabel(plantelNombre,{ exact: true }).check(); await docenteForm.getByRole('button',{ name: 'Guardar docente' }).click();
      await page.locator('tr').filter({ hasText: empleado }).getByRole('button',{ name: 'Editar',exact: true }).click(); await expect(docenteForm.getByLabel('Cédula profesional')).toHaveValue('CED123456'); await expect(docenteForm.getByLabel('Segundo apellido')).toHaveValue('Materno'); await docenteForm.getByLabel('Teléfono',{ exact: true }).fill(''); await docenteForm.getByRole('button',{ name: 'Guardar docente' }).click();
      await page.getByRole('link',{ name: 'Usuarios',exact: true }).click(); const personal = page.locator('section').filter({ has: page.getByRole('heading',{ name: 'Crear cuenta de personal',exact: true }) });
      for (const rol of ['ADMINISTRATIVO','FINANZAS','SUPERADMIN']) {
        await page.getByRole('button',{name:/Registrar personal/}).click();
        const email = `web${rol.toLowerCase()}_${d.sufijo}@example.invalid`; await personal.getByLabel('Nombre',{ exact: true }).fill('Personal'); await personal.getByLabel('Primer apellido').fill(rol); await personal.getByLabel('Segundo apellido').fill('Institucional'); await personal.getByLabel('Teléfono',{ exact: true }).fill('5550003333'); await personal.getByLabel('Correo',{ exact: true }).fill(email); await expect(personal.getByLabel('Contraseña temporal',{ exact: true })).toHaveCount(0);
        for (const opcion of ['ADMINISTRATIVO','FINANZAS','SUPERADMIN']) await personal.getByLabel(opcion,{ exact: true }).setChecked(opcion === rol); await personal.getByLabel(plantelNombre,{ exact: true }).check(); await personal.getByRole('button',{ name: 'Crear',exact: true }).click(); await expect(page.getByText('Cuenta creada. Si el correo está disponible, recibirá instrucciones para activarla.',{ exact: true })).toBeVisible(); await page.getByRole('button',{name:'Volver a opciones',exact:true}).click();
      }
    }
    assert.deepEqual(errores, [], 'Errores JavaScript en el recorrido'); await page.reload(); await expect(page.getByRole('link', { name: 'Alumnos', exact: true })).toBeVisible();
  } finally { if (browser) await browser.close(); server.kill('SIGTERM'); await new Promise<void>((r) => { if (server.exitCode !== null) r(); else server.once('exit', () => r()); }); }
}
