// Comprobación visual con API simulada y datos sintéticos; no sustituye API/BD ni UAT.
const { chromium, expect } = require('@playwright/test');
const { spawn } = require('node:child_process');
const { resolve } = require('node:path');
const { readFileSync, mkdirSync } = require('node:fs');
const root = resolve(__dirname, '..');
const salida = resolve(root, '../work/calendario/visual'); mkdirSync(salida, { recursive: true });
const server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5183', '--strictPort'], { cwd: root, env: { ...process.env, VITE_API_URL: '/api' }, stdio: 'ignore' });
let browser;
(async () => {
  for (let i=0;i<100;i++) { try { if ((await fetch('http://127.0.0.1:5183')).ok) break; } catch {} await new Promise(r => setTimeout(r,100)); }
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errores = []; page.on('pageerror', e => errores.push(e.message));
  // Reutiliza exactamente la paleta inicial del servidor; los eventos de esta prueba son ficticios.
  const fuente=readFileSync(resolve(root,'../backend/src/calendario/marcadores.ts'),'utf8');
  const marcadores=[...fuente.matchAll(/\['([^']+)', '([^']+)', '(#[A-Fa-f0-9]+)', '(FONDO|INICIO|FIN)'\]/g)].map(m=>({clave:m[1],nombre:m[2],color:m[3],forma:m[4],revision:0}));
  let ciclo = {id:1,nombre:'2027-1 · datos de demostración',fechaInicio:'2026-09-01',fechaFin:'2026-12-31',activo:true};
  const eventos = marcadores.map((m,i)=>({id:i+1,titulo:m.nombre,marcador:m,marcadorClave:m.clave,revision:'x'.repeat(64),imagenNombre:null,audiencia:'ACADEMICA',cicloId:1,nivelId:1,
    fechaInicio:`2026-${String(9+Math.floor(i/4)).padStart(2,'0')}-${String(1+(i%4)*5).padStart(2,'0')}T06:00:00Z`,fechaFin:null}));
  eventos.push({id:99,titulo:'Evento anterior sin marcador',fechaInicio:'2026-09-03T06:00:00Z',fechaFin:null,imagenNombre:null});
  await page.route('**/uploads/marca-logo-*.png', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><circle cx="60" cy="60" r="54" fill="#fff" stroke="#A33925" stroke-width="4"/><text x="60" y="67" text-anchor="middle" fill="#A33925" font-family="serif" font-size="34">IUA</text><text x="60" y="88" text-anchor="middle" font-size="9">DEMO</text></svg>' }));
  await page.route(url => url.pathname.startsWith('/api/'), async route=>{
    const path=new URL(route.request().url()).pathname; let data=[];
    if(path.endsWith('/auth/refresh'))data={accessToken:'qa-preview'};
    if(path.endsWith('/auth/me'))data={id:1,nombreCompleto:'Persona de prueba',email:'qa@example.invalid',roles:[{clave:'SUPERADMIN'}]};
    if(path.endsWith('/configuracion/marca'))data={nombreInstitucion:'Universidad IUA · ejemplo de diseño',nombreCorto:'IUA',logoUrl:'/uploads/marca-logo-00000000-0000-0000-0000-000000000001.png',colorPrimario:'#14343B',colorPrimarioOscuro:'#0E262B',colorAcento:'#C79A3C',actualizadoEn:'2026-10-28',tamanoLogo:'NORMAL'};
    if(path.endsWith('/calendario/opciones'))data={ciclos:[ciclo],niveles:[{id:1,nombre:'Todos los programas del ejemplo',plantelId:1,plantel:{nombre:'Plantel de prueba'}}]};
    if(path.endsWith('/calendario/marcadores'))data=marcadores;
    if(path.endsWith('/calendario'))data=eventos;
    if(path.endsWith('/calendario/listado'))data={datos:[],total:0,pagina:1,porPagina:10};
    await route.fulfill({status:200,json:data});
  });
  await page.goto('http://127.0.0.1:5183/calendario?vista=consulta');
  await expect(page.getByRole('article',{name:'Calendario institucional para imprimir'})).toBeVisible({ timeout: 20000 }).catch(async e => { console.error('Página:', await page.locator('body').innerText(), 'Errores:', errores); throw e; });
  const bienvenida=page.locator('aside.recorrido-panel'); if(await bienvenida.isVisible()) await bienvenida.getByRole('button',{name:'Omitir recorrido'}).click();
  const lamina=page.locator('.calendario-lamina');
  await expect(lamina.locator('.calendario-mes')).toHaveCount(4);
  await expect(page.getByLabel('Leyenda de marcadores').locator('li')).toHaveCount(17);
  await lamina.screenshot({path:resolve(salida,'calendario-escritorio.png')});
  for(const width of [360,768,1280]){
    await page.setViewportSize({width,height:1000});
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Desbordamiento horizontal a '+width);
    await lamina.screenshot({path:resolve(salida,`calendario-${width}.png`)});
  }
  await page.emulateMedia({media:'print'});
  await page.pdf({path:resolve(salida,'calendario-institucional.pdf'),preferCSSPageSize:true,printBackground:true});
  await page.emulateMedia({media:'screen'});
  ciclo = {...ciclo, nombre:'2026-2027 · demostración anual', fechaFin:'2027-08-31'};
  await page.setViewportSize({width:1440,height:1100});
  await page.reload();
  await expect(page.locator('.calendario-mes')).toHaveCount(12);
  await page.locator('.calendario-lamina').screenshot({path:resolve(salida,'calendario-anual.png')});
  await page.emulateMedia({media:'print'});
  const pdf = await page.pdf({path:resolve(salida,'calendario-anual.pdf'),preferCSSPageSize:true,printBackground:true});
  const paginas = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
  if (paginas !== 1) throw Error('La lámina anual debería caber en una página A3; páginas: '+paginas);
  if(errores.length)throw Error(errores.join('\n'));
  console.log(JSON.stringify({meses:[4,12],marcadores:16,anchos:[360,768,1280],pdf:'generado',api:'simulada'}));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.kill();});
