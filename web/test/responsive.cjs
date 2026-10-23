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
          porPagina: 10,
        };
      if (path.endsWith('/docentes'))
        data = {
          datos: [{ id: 1, numEmpleado: 'DOC-QA-001', estatus: 'ACTIVO',
            especialidad: 'Matemáticas y ciencias con especialidad extensa',
            usuario: { nombre: 'Docente con nombre extenso', apellidoPaterno: 'Prueba',
              email: 'docente.con.correo.extenso@example.test' },
            planteles: ['Plantel de Prueba con un Nombre Extenso'],
          }], total: 1, pagina: 1, porPagina: 10,
        };
      if (path.endsWith('/docentes/1')) data = { id: 1, numEmpleado: 'DOC-QA-001', estatus: 'ACTIVO', usuario: { nombre: 'Docente con nombre extenso', apellidoPaterno: 'Prueba', email: 'docente.con.correo.extenso@example.test' }, plantelIds: [1], clases: [] };
      if (path.endsWith('/cartera')) data = { datos: [], total: 0, pagina: 1, porPagina: 10 };
      if (path.endsWith('/recursamientos')) data = { datos: [], total: 0, pagina: 1, porPagina: 10 };
      if (path.endsWith('/programas-especiales')) data = { datos: [], total: 0, pagina: 1, porPagina: 10 };
      if (/\/academico\/catalogos\/(niveles|carreras|periodos)$/.test(path)) data = { datos: [{ id: 1, clave: 'NIV-QA', nombre: 'Catálogo institucional de prueba', activo: true }], total: 1, pagina: 1, porPagina: 10 };
      if (path.endsWith('/academico/grupos'))
        data = { datos: [{ id: 1, nombre: 'GR-QA-001', grado: 'Primero', turno: 'MATUTINO',
          ciclo: { id: 1, clave: '2026-2027', activo: true, estado: 'VIGENTE' },
          plantel: { id: 1, nombre: 'Plantel de Grupos con un Nombre Extenso de Prueba' } }],
          total: 1, pagina: 1, porPagina: 10 };
      if (path.endsWith('/planteles'))
        data = [{ id: 1, clave: 'PL-QA-001', nombre: 'Plantel con un Nombre Extenso de Prueba',
          municipio: 'Municipio con un Nombre Extenso de Prueba', activo: true }];
      if (path.endsWith('/planteles/1'))
        data = { id: 1, clave: 'PL-QA-001', nombre: 'Plantel con un Nombre Extenso de Prueba',
          conteos: { alumnos: 1, grupos: 1 }, director: null,
          personal: [{ id: 1, nombre: 'Personal con un Nombre Extenso de Prueba',
            email: 'personal.con.correo.extenso@example.test', roles: ['ADMINISTRATIVO', 'FINANZAS'] }],
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
      if (path.endsWith('/reportes/cobranza/serie'))
        data = { datos: [{ periodo: '2026-10', cobrado: 1000 }], moneda: 'MXN', base: 'Pagos confirmados' };
      if (path.endsWith('/reportes/resumen'))
        data = {
          alumnosActivos: 20,
          docentesActivos: 10,
          grupos: 5,
          saldoPendiente: 500,
          cargosConAdeudo: 5,
          cobradoMes: 1000,
        };
      if (/\/academico\/grupos\/\d+\/(materias|alumnos)$/.test(path)) data = [];
      const claseBeta = { id: 1, grupo: { id: 1, nombre: 'Grupo Beta', ciclo: { id: 1, nombre: '2026–2027', clave: '2026' }, plantel: { nombre: 'Plantel Beta' } }, materia: { clave: 'MAT', nombre: 'Matemáticas' } };
      if (path.endsWith('/planteles/mios')) data = [{ id: 1, nombre: 'Plantel Beta' }];
      if (path.endsWith('/academico/materias/listado')) data = { datos: [], total: 0, pagina: 1, porPagina: 10 };
      if (path.endsWith('/planteles/listado')) data = {datos:[{id:1,clave:'PL-QA-001',nombre:'Plantel de Prueba con un Nombre Extenso',municipio:'Municipio de prueba',activo:true}],total:1,pagina:1,porPagina:10};
      if (path.endsWith('/academico/ciclos/listado')) data = {datos:[],total:0,pagina:1,porPagina:10};
      if (path.endsWith('/academico/grupos/1')) data = {id:1,nombre:'GR-QA-001',plantel:{id:1,nombre:'Plantel Beta'},ciclo:{id:1,clave:'2026',activo:true,estado:'ACTIVO'}};
      if (path.endsWith('/usuarios/listado')) data = { datos: [{ id: 1, matricula: 'US-QA-001', nombre: 'Usuario con nombre largo de prueba', correo: 'correo.extenso.de.prueba@example.invalid', plantel: 'Plantel Beta', estatus: 'ACTIVO' }], total: 1, pagina: 1, porPagina: 10 };
      if (path.endsWith('/academico/mis-grupos') || path.endsWith('/academico/grupo-materias')) data = [claseBeta];
      if (path.endsWith('/academico/clases-seleccion')) data = { datos: [claseBeta], total: 1 };
      const actividadDocente={id:1,grupoMateriaId:1,titulo:'Actividad de prueba',descripcion:'Contenido',tipo:'TAREA',parcial:1,ponderacion:0,fechaEntrega:null};
      const materialDocente={id:1,grupoMateriaId:1,titulo:'Guía de prueba',archivoNombre:'guia.txt',tamanoKb:1,createdAt:'2026-10-19T12:00:00Z'};
      const entregaDocente={id:1,actividadId:1,alumno:{id:1,matricula:'ALUMNO-QA-001',usuario:{nombre:'Alumno Beta',apellidoPaterno:'Prueba'}},estatus:'ENTREGADA',calificacion:null,comentarioAlumno:'Comentario de prueba',comentarioDocente:null,archivoRuta:null,fechaEntregado:'2026-10-19T12:00:00Z'};
      if(path.endsWith('/grupo-materias/1/detalle')) data=claseBeta;
      if(path.endsWith('/grupo-materias/1/actividades/listado')) data={datos:[actividadDocente],total:12,pagina:1,porPagina:10};
      if(path.endsWith('/grupo-materias/1/materiales/listado')) data={datos:[materialDocente],total:12,pagina:1,porPagina:10};
      if(path.endsWith('/actividades/1')) data=actividadDocente;
      if(path.endsWith('/materiales/1')) data=materialDocente;
      if(path.endsWith('/actividades/1/entregas/listado')) data={datos:[entregaDocente],total:12,pagina:1,porPagina:10};
      if(path.endsWith('/entregas/1')) data=entregaDocente;

      const temaBeta = {id:1,grupoMateriaId:1,indice:1,titulo:'Unidad temática de prueba con un título extenso',contenido:'Contenido independiente de tareas y calificaciones. '.repeat(8),estado:'PUBLICADO',revision:1,desde:null,hasta:null,parcial:null,enlace:null,adjuntos:[]};
      if(path.endsWith('/grupo-materias/1/temario')) data={datos:[temaBeta],total:12,pagina:1,porPagina:10};
      if(path.endsWith('/temarios/1')) data=temaBeta;
      if(path.endsWith('/academico/ciclos/1/ficha')) data={ciclo:{id:1,clave:'2026',nombre:'Ciclo escolar de prueba',estado:'ACTIVO',fechaInicio:'2026-01-01',fechaFin:'2026-12-31'},resumen:{grupos:12,planteles:1,niveles:1,planes:1,periodos:1,clases:12,materias:2,docentes:3},datos:[{id:1,nombre:'Grupo de prueba',tipo:'REGULAR',turno:'MATUTINO',activo:true,plantel:{nombre:'Plantel Beta'},nivel:'Nivel académico',carrera:'Carrera de prueba',plan:'Plan vigente',periodo:'Primer periodo'}],total:12,pagina:1,porPagina:10,clases:{datos:[{id:1,grupo:'Grupo de prueba',materia:'Matemáticas',clave:'MAT',docente:{nombre:'Docente de prueba'}}],total:12,pagina:1,porPagina:10}};

      if (path.endsWith('/academico/grupos/1/alumnos')) data = [{ id: 1, alumno: { id: 1, matricula: 'NO-QA-001', usuario: { nombre: 'Alumno Beta', apellidoPaterno: 'Prueba' } } }];
      if (path.endsWith('/calificaciones/periodos/1/1')) data = { estatus: 'ABIERTO', inscritos: 1, capturados: 0, faltantes: 1 };
      if (path.endsWith('/calificaciones/periodos/1/1/historial')) data = { datos: [{ id: 1, alumnoId: 1, fecha: '2026-10-13T12:00:00Z', valorAnterior: 80, valorNuevo: 90, usuarioId: 1, motivo: 'Corrección autorizada de prueba' }], total: 1, pagina: 1, porPagina: 10 };
      if (path.endsWith('/calendario/listado')) data = {datos:[],total:0,pagina:1,porPagina:10};
      if (path.endsWith('/biblioteca')) data = { carpetas: [{ id: 1, nombre: 'Documentos Beta', padreId: null }], archivos: [{ id: 1, titulo: 'Calendario institucional de prueba para familias y docentes', archivoNombre: 'calendario-con-nombre-extenso.pdf', categoria: 'CALENDARIO', bytes: 512 }], total: 1, pagina: 1, porPagina: 10, bytes: 512, cuota: 104857600 };
      if (path.endsWith('/academico/bitacora')) data = { datos: [], total: 0, pagina: 1 };
      if (path.endsWith('/importaciones/preview')) data = { previewId: 'qa-preview', registros: 1, errores: [], regla: 'Confirmación atómica del lote', identificadores: [{ fila: 2, identificador: 'ALUMNO-QA-001' }] };
      if (['/finanzas/cargos', '/finanzas/pagos', '/finanzas/adeudos', '/conducta/incidencias', '/finanzas/conciliacion/ordenes', '/finanzas/conciliacion/pagos', '/finanzas/conciliacion/resoluciones'].some(p => path.endsWith(p)))
        data = { datos: [], total: 0, pagina: 1, porPagina: 10 };
      const cargoQA = { id: 1, descripcion: 'Colegiatura con descripción extensa para comprobar el ancho', periodo: '2026-10', monto: 123456.78, descuento: 0, recargo: 0, fechaVencimiento: '2026-10-31', estatus: 'PENDIENTE', total: 123456.78, pagado: 0, saldo: 123456.78, alumno: { id: 1, matricula: 'FIN-QA-001', usuario: { nombre: 'Alumno con nombre extenso de prueba', apellidoPaterno: 'Prueba' } } };
      if (path.endsWith('/finanzas/cargos') || path.endsWith('/finanzas/adeudos')) data = { datos: [cargoQA], total: 1, pagina: 1, porPagina: 10 };
      if (path.endsWith('/finanzas/pagos')) data = { datos: [{ id: 1, monto: 123456.78, metodo: 'TRANSFERENCIA', referencia: 'REFERENCIA_' + 'larga'.repeat(15), fechaPago: '2026-10-15T12:00:00Z', estatus: 'APLICADO', alumno: cargoQA.alumno }], total: 1, pagina: 1, porPagina: 10 };
      if (path.endsWith('/auth/solicitar-activacion')) data = { mensaje: 'Si la cuenta está pendiente y el correo está disponible, recibirás instrucciones.' };
      if (path.endsWith('/auth/activar-cuenta')) data = { mensaje: 'Cuenta activada. Inicia sesión.' };
      if (path.endsWith('/auth/forgot-password')) data = { mensaje: 'Solicitud recibida' };
      if (path.endsWith('/finanzas/cobranza/envios')) data = { datos: [{ id: 1, usuarioId: 1, plantelId: 1, saldo: 123456.78, estado: 'ERROR', intentos: 1, error: 'SMTP_' + 'sin_conexion_'.repeat(20) }], total: 1, pagina: 1 };
      await route.fulfill({ json: data });
    },
  );
  if (!process.env.RESPONSIVE_EXTENDED_ONLY) {
  for (const width of [320, 375, 360, 768, 1024, 1440, 2560, 3840]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:5182/');
    try {
      await expect(page.locator('.panel-bienvenida')).toBeVisible();
    } catch (e) {
      console.log('BODY', await page.locator('body').innerText(), 'ERRORS', errors);
      throw e;
    }
    if (width === 320 && await page.getByRole('button', { name: 'Omitir recorrido' }).count()) {
      await page.getByRole('button', { name: 'Omitir recorrido' }).click();
    }
    const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
    if (sizes.scroll > sizes.width) throw Error('Overflow ' + width + ': ' + JSON.stringify(sizes));
    if (width <= 800) {
      const botonMenu = page.getByRole('button', { name: /Abrir menú/ });
      const posicionBoton = await botonMenu.boundingBox();
      if (!posicionBoton || posicionBoton.x < width / 2) {
        throw Error('El botón de menú debe estar en el lado derecho, como el cajón: ' + width);
      }
      await botonMenu.click();
      await expect(page.locator('.menu-fondo')).toHaveCSS('background-color', 'rgba(8, 27, 31, 0.38)');
      await expect(page.getByRole('button', { name: 'Cerrar menú', exact: true })).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(page.locator('.panel-bienvenida')).toBeVisible();
      await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
      await expect(page.getByRole('button', { name: 'Cerrar menú', exact: true })).toBeFocused();
      await page.locator('#contenido-principal').evaluate((el) => el.focus());
      await expect(page.getByRole('button', { name: 'Cerrar menú', exact: true })).toBeFocused();
      await page.locator('.skip-link').evaluate((el) => el.focus());
      await expect(page.getByRole('button', { name: 'Cerrar menú', exact: true })).toBeFocused();
      await expect.poll(async () => {
        const cajon = await page.locator('.lateral').boundingBox();
        return !!cajon && Math.abs(cajon.width - width / 2) <= 1 && Math.abs(cajon.x - width / 2) <= 1;
      }).toBe(true);
      await page.getByRole('link', { name: 'Alumnos', exact: true }).focus();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: /Abrir menú/ })).toBeFocused();
      await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
      await page.getByRole('button', { name: /Abrir menú/ }).click();
      await page.locator('.menu-fondo').click({ position: { x: 10, y: 850 } });
      await expect(page.getByRole('button', { name: /Abrir menú/ })).toBeFocused();
    }
    console.log('PASS responsive ' + width);
  }
  await page.setViewportSize({ width: 360, height: 900 });
  await page.getByRole('button', { name: /Abrir menú/ }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  console.log('PASS resize mobile to desktop');
  for (const width of [320, 375, 360, 768, 1024, 1440, 2560, 3840]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:5182/alumnos');
    await page.getByRole('button',{name:/Registrar alumno/}).click();
    await expect(page.getByRole('heading', { name: 'Registrar alumno' })).toBeVisible();
    const geometry = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      width: innerWidth,
      oversized: [...document.querySelectorAll('#form-alumno input,#form-alumno select')].filter(
        (e) => e.getBoundingClientRect().right > innerWidth,
      ).length,
    }));
    if (geometry.scroll > geometry.width || geometry.oversized)
      throw Error('Form overflow ' + width + ': ' + JSON.stringify(geometry));
    await page.getByRole('button',{name:'Cancelar y volver a consulta',exact:true}).click();
    await expect(page.getByText('QA-001', { exact: true })).toBeVisible();
    await page.locator('.tabla-contenedor').scrollIntoViewIfNeeded();
    await page.locator('.tabla-contenedor').evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await expect(page.getByRole('button', { name: 'Dar de baja', exact: true })).toBeInViewport();
    console.log('PASS forms/table ' + width);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const width of [320, 375, 360, 768, 1024, 1440, 2560, 3840]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(baseUrl + '/analitica');
    await page.getByRole('button',{name:/Consultar indicadores/}).click();
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
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(baseUrl + '/catalogos-academicos');
    await page.getByRole('button', { name: /Niveles académicos/ }).click();
    await expect(page.getByText('NIV-QA', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Registrar', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toHaveCount(0);
    await page.getByLabel('Nombre', { exact: true }).fill('Catálogo pendiente');
    await page.getByRole('button', { name: 'Cancelar y volver' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(page.getByText('NIV-QA', { exact: true })).toBeVisible();
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Catálogos desborda ' + width);
    console.log('PASS catálogos ' + width);
  }
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(baseUrl + '/programas-especiales');
    await page.getByRole('button', { name: /Consultar programas/ }).click();
    await expect(page.getByText('Sin programas para esta consulta.')).toBeVisible();
    await page.getByRole('link', { name: 'Registrar programa', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toHaveCount(0);
    await page.getByLabel('Nombre', { exact: true }).fill('Programa pendiente');
    await page.getByRole('button', { name: 'Cancelar y volver' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(page.getByText('Sin programas para esta consulta.')).toBeVisible();
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Programas desborda ' + width);
    console.log('PASS programas especiales ' + width);
  }
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(baseUrl + '/recursamientos');
    await page.getByRole('button', { name: /Consultar intentos/ }).click();
    await expect(page.getByText('Sin intentos para esta consulta.')).toBeVisible();
    await page.getByRole('link', { name: 'Nuevo recursamiento', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toHaveCount(0);
    const cupo = page.getByLabel('Cupo total manual de la clase');
    await expect(cupo).toHaveValue('');
    await cupo.fill('8');
    await page.getByRole('button', { name: 'Cancelar y volver' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(page.getByText('Sin intentos para esta consulta.')).toBeVisible();
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Recursamientos desborda ' + width);
    console.log('PASS recursamientos ' + width);
  }
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(baseUrl + '/apertura-cartera');
    await page.getByRole('button', { name: /Consultar aperturas/ }).click();
    await expect(page.getByText('Sin aperturas para esta consulta.')).toBeVisible();
    await page.getByRole('link', { name: 'Nueva apertura', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toHaveCount(0);
    await page.getByLabel('Fecha de vencimiento').fill('2054-02-05');
    await page.getByRole('button', { name: 'Volver a aperturas' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(page.getByText('Sin aperturas para esta consulta.')).toBeVisible();
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Cartera desborda ' + width);
    console.log('PASS cartera ' + width);
  }
  for (const width of [320, 360, 700, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(baseUrl + '/docentes');
    await page.getByRole('button', { name: /Consultar docentes/ }).click();
    await expect(page.getByText('DOC-QA-001', { exact: true })).toBeVisible();
    const listado = page.getByRole('region', { name: 'Listado de docentes' });
    const geometry = await listado.evaluate((el) => ({
      scroll: document.documentElement.scrollWidth, width: innerWidth,
      desbordamiento: el.scrollWidth > el.clientWidth + 1,
      ficha: getComputedStyle(el.querySelector('tbody tr')).display === 'block',
    }));
    if (geometry.scroll > geometry.width || (width <= 700 && (geometry.desbordamiento || !geometry.ficha)))
      throw Error('Docentes layout ' + width + ': ' + JSON.stringify(geometry));
    await listado.scrollIntoViewIfNeeded();
    await listado.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await expect(listado.getByRole('button', { name: 'Dar de baja', exact: true })).toBeInViewport();
    await expect(listado.getByRole('table')).toHaveCount(1);
    await listado.getByRole('button', { name: 'Editar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Editar docente' })).toBeVisible();
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Docente con nombre extenso');
    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Listado de docentes' })).toHaveCount(0);
    const ancho = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
    if (ancho.scroll > ancho.width) throw Error('Formulario docente desborda ' + width);
    await page.getByLabel('Nombre', { exact: true }).fill('Cambio pendiente');
    await page.getByRole('button', { name: 'Cancelar y volver' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Cambio pendiente');
    await page.getByRole('button', { name: 'Cancelar y volver' }).click();
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(page.getByText('DOC-QA-001', { exact: true })).toBeVisible();
    console.log('PASS docentes ' + width);
  }
  for (const width of [320, 360, 700, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(baseUrl + '/planteles');
    await page.getByRole('button',{name:/Consultar planteles/}).click();
    const listado = page.getByRole('region', { name: 'Listado de planteles' });
    await expect(listado.getByText('PL-QA-001', { exact: true })).toBeVisible();
    await expect(listado.getByRole('table')).toHaveCount(1);
    const anchoListado = await listado.evaluate(el => ({scroll:document.documentElement.scrollWidth,width:innerWidth,ficha:getComputedStyle(el.querySelector('tbody tr')).display === 'block'}));
    if(anchoListado.scroll > anchoListado.width || (width <= 700 && !anchoListado.ficha)) throw Error('Planteles listado '+width);
    await listado.getByRole('button', { name: 'Ver detalle' }).click();
    const personal = page.getByRole('region', { name: 'Personal del plantel' });
    await expect(personal.getByText('personal.con.correo.extenso@example.test')).toBeVisible();
    for (const region of [personal]) {
      const geometry = await region.evaluate((el) => ({
        scroll: document.documentElement.scrollWidth, width: innerWidth,
        desbordamiento: el.scrollWidth > el.clientWidth + 1,
        ficha: getComputedStyle(el.querySelector('tbody tr')).display === 'block',
      }));
      if (geometry.scroll > geometry.width || (width <= 700 && (geometry.desbordamiento || !geometry.ficha)))
        throw Error('Planteles layout ' + width + ': ' + JSON.stringify(geometry));
      await expect(region.getByRole('table')).toHaveCount(1);
    }
    await personal.scrollIntoViewIfNeeded();
    await personal.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await expect(personal.getByRole('button', { name: 'Quitar', exact: true })).toBeInViewport();
    console.log('PASS planteles/personal ' + width);
  }
  for (const width of [320, 360, 700, 768, 1440, 3840]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(baseUrl + '/grupos');
    await page.getByRole('button',{name:/Consultar grupos/}).click();
    const listado = page.getByRole('region', { name: 'Listado de grupos' });
    await expect(listado.getByText('GR-QA-001', { exact: true })).toBeVisible();
    const geometry = await listado.evaluate((el) => ({
      scroll: document.documentElement.scrollWidth, width: innerWidth,
      desbordamiento: el.scrollWidth > el.clientWidth + 1,
      ficha: getComputedStyle(el.querySelector('tbody tr')).display === 'block',
    }));
    if (geometry.scroll > geometry.width || (width <= 700 && (geometry.desbordamiento || !geometry.ficha)))
      throw Error('Grupos layout ' + width + ': ' + JSON.stringify(geometry));
    await listado.scrollIntoViewIfNeeded();
    await listado.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await expect(listado.getByRole('button', { name: 'Desactivar grupo', exact: true })).toBeInViewport();
    await listado.getByRole('button', { name: 'Administrar' }).click();
    await expect(page.getByRole('heading', { name: /Materias del grupo GR-QA-001/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar detalle del grupo' })).toHaveCount(0);
    console.log('PASS grupos ' + width);
  }
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const ruta of ['/usuarios', '/materias', '/maestro', '/calificaciones', '/biblioteca', '/operaciones']) {
      await page.goto(baseUrl + ruta);
      const accion = {'/usuarios':'Consultar usuarios','/materias':'Consultar materias','/maestro':'Consultar mis clases','/calificaciones':'Consultar calificaciones','/biblioteca':'Consultar biblioteca','/operaciones':'Importar expedientes'}[ruta];
      await page.getByRole('button',{name:new RegExp(accion)}).click();
      await expect(page.locator('h1')).toBeVisible();
      if (ruta === '/operaciones') {
        await page.getByLabel('Archivo', { exact: true }).setInputFiles({ name: 'lote.csv', mimeType: 'text/csv', buffer: Buffer.from('matricula,grupoId\nALUMNO-QA-001,1') });
        await page.getByRole('button', { name: 'Previsualizar archivo' }).click();
        await expect(page.getByRole('region', { name: 'Filas de previsualización' })).toBeVisible();
      }
      if (ruta === '/materias') await expect(page.getByLabel('Buscar materias por clave o nombre')).toBeVisible();
      if (ruta === '/usuarios') await expect(page.getByText('US-QA-001')).toBeVisible();
      if (ruta === '/calificaciones') {
        await expect(page.getByLabel('Clase').locator('option[value="1"]')).toBeAttached();
        await page.getByLabel('Clase', { exact: true }).selectOption('1');
        await page.getByRole('button', { name: 'Cargar lista', exact: true }).click();
        await expect(page.getByLabel('Calificación de NO-QA-001')).toBeVisible();
      }
      if (ruta === '/biblioteca') { await page.getByLabel('Plantel', { exact: true }).selectOption('1'); await expect(page.getByText('calendario-con-nombre-extenso.pdf')).toBeVisible(); }
      const geometry = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
      if (geometry.scroll > geometry.width) throw Error('Beta overflow ' + ruta + ' ' + width + ': ' + JSON.stringify(geometry));
      const tabla = page.getByRole('table').first();
      if (await tabla.count()) {
        await tabla.scrollIntoViewIfNeeded();
        const region = tabla.locator('..'); await region.focus();
        await expect(region).toBeFocused();
      }
      if(ruta === '/operaciones') {
        await page.getByRole('button',{name:'Cancelar y volver a consulta',exact:true}).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();
        await expect(page.getByRole('region',{name:'Filas de previsualización'})).toBeVisible();
        await page.getByRole('button',{name:'Cancelar y volver a consulta',exact:true}).click();
        await page.getByRole('dialog').getByRole('button',{name:'Confirmar',exact:true}).click();
      }
      console.log('PASS beta ' + ruta + ' ' + width);
    }
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
      iconos.length !== await page.locator('.lateral nav a').count() || iconos.length === 0 ||
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
      await page.goto(baseUrl + '/analitica', { waitUntil: 'domcontentloaded' }); await page.getByRole('button',{name:/Consultar indicadores/}).click();
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
  }
  for (const [width, height, escala] of [[320, 568, 1], [375, 667, 2], [568, 320, 1], [768, 1024, 1], [1024, 768, 1], [1440, 900, 2]]) {
    await page.setViewportSize({ width, height });
    for (const ruta of ['/cuenta', '/configuracion', '/conducta', '/calendario', '/avisos', '/finanzas', '/pago-completado', '/temarios?vista=consulta&clase=1', '/temarios?vista=nuevo&clase=1', '/temarios?vista=detalle&id=1', '/temarios?vista=adjuntar&id=1', '/ciclos/1', '/maestro?vista=clase&clase=1', '/maestro?vista=actividades&clase=1', '/maestro?vista=actividad-nueva&clase=1', '/maestro?vista=actividad-editar&clase=1&id=1', '/maestro?vista=materiales&clase=1', '/maestro?vista=material-nuevo&clase=1', '/maestro?vista=material-editar&clase=1&id=1', '/maestro?vista=entregas&clase=1&actividad=1', '/maestro?vista=calificar-entrega&clase=1&actividad=1&id=1']) {
      console.log('CHECK extended', ruta, width, height, escala);
      await page.goto(baseUrl + ruta);
      const accion = {'/conducta':'Consultar incidencias','/calendario':'Consultar calendario','/avisos':'Redactar aviso'}[ruta];
      if(accion) await page.getByRole('button',{name:new RegExp(accion)}).click();
      try { await expect(page.locator('h1')).toBeVisible(); } catch (error) { console.log(await page.locator('body').innerText(), errors); throw error; }
      await page.evaluate(escala => { document.documentElement.style.fontSize = `${escala * 100}%`; }, escala);
      if (ruta === '/finanzas') {
        for (const nombre of ['Consultar cargos', 'Consultar pagos', 'Adeudos y cobranza']) {
          await page.getByRole('button', { name: new RegExp(nombre) }).click();
          const region = page.getByRole('tabpanel').getByRole('region').first();
          await expect(region.getByText('FIN-QA-001', { exact: false })).toBeVisible();
          await region.scrollIntoViewIfNeeded();
          await region.focus();
          await expect(region).toBeFocused();
          if (width <= 768) {
            await region.evaluate(el => { el.scrollLeft = 0; });
            await page.keyboard.press('ArrowRight');
            await expect.poll(() => region.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
          }
          if(nombre !== 'Adeudos y cobranza') await page.getByRole('button',{name:'Volver a opciones',exact:true}).click();
        }
        await expect(page.getByText('SMTP_', { exact: false })).toBeVisible();
        await page.getByRole('button', { name: 'Reintentar con motivo' }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        const dialogo = await page.getByRole('dialog').evaluate(el => ({ ancho: el.clientWidth, scroll: el.scrollWidth, alto: el.getBoundingClientRect().height, limite: innerHeight }));
        if (dialogo.scroll > dialogo.ancho + 1 || dialogo.alto > dialogo.limite) throw Error('Dialog layout ' + JSON.stringify({ width, height, escala, dialogo }));
        await page.keyboard.press('Escape');
      }
      const geometria = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
      if (geometria.scroll > geometria.width + 1) { console.log('Overflow elements', await page.evaluate(() => [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0,15).map(e => ({tag:e.tagName,clase:e.className,texto:e.textContent.slice(0,60),ancho:e.getBoundingClientRect().width})))); throw Error('Extended overflow ' + ruta + ' ' + JSON.stringify({ width, height, escala, geometria })); }
      console.log('PASS extended ' + ruta + ' ' + width + 'x' + height + ' text=' + escala);
    }
  }
  await page.route('**/api/auth/refresh', route => route.fulfill({ status: 401, json: { message: 'No autenticado' } }));
  for (const [width, height] of [[320, 568], [568, 320], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await page.goto(baseUrl + '/login');
    await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
    await page.getByLabel('Correo institucional').fill('qa@example.test');
    await page.getByRole('button', { name: 'Enviar código', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Restablecer contraseña', exact: true })).toBeVisible();
    const geometria = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
    if (geometria.scroll > geometria.width + 1) throw Error('Login overflow ' + JSON.stringify(geometria));
    console.log('PASS recovery ' + width + 'x' + height);
    await page.goto(baseUrl + '/login');
    await page.getByRole('button', { name: 'Activar mi cuenta por primera vez' }).click();
    await page.getByLabel('Correo institucional del alumno').fill('alumno@example.test');
    await page.getByRole('button', { name: 'Solicitar código de activación', exact: true }).click();
    await page.getByLabel('Código de activación (64 caracteres)').fill('a'.repeat(64));
    await page.getByLabel('Nueva contraseña (mínimo 8 caracteres)').fill('Nueva_Segura_42!');
    const activacion = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
    if (activacion.scroll > activacion.width + 1) throw Error('Activation overflow ' + JSON.stringify(activacion));
    await page.getByRole('button', { name: 'Activar mi cuenta', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Cuenta activada');
    console.log('PASS activation ' + width + 'x' + height);
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
