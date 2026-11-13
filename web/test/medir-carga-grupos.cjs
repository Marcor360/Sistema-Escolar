// Medición reproducible del cliente con API simulada; no representa latencia de producción.
const { chromium, expect } = require('@playwright/test');
const { spawn } = require('node:child_process');
const { resolve } = require('node:path');
const { writeFileSync } = require('node:fs');
const root = process.env.MEDICION_RAIZ || resolve(__dirname, '..'), base = 'http://127.0.0.1:5194';
const server = spawn(process.execPath,[resolve(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5194','--strictPort'],{cwd:root,env:{...process.env,VITE_API_URL:'/api'},stdio:'ignore'});
let browser;
(async()=>{
 for(let n=0;n<100;n++){try{if((await fetch(base)).ok)break;}catch{} await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{})});
 const resultados=[];
 for(let n=0;n<5;n++){
  const page=await browser.newPage();const llamadas=[];
  await page.addInitScript(()=>localStorage.setItem('escolar_recorrido_web_v2_1_SUPERADMIN','1'));
  const grupo={id:1,nombre:'Grupo QA',plantel:{id:1,nombre:'Sede QA'},ciclo:{id:1,clave:'2026',activo:true,estado:'ACTIVO'}};
  await page.route(u=>u.pathname.startsWith('/api/'),async route=>{
   const p=new URL(route.request().url()).pathname;let data=[];
   if(p.endsWith('/auth/refresh'))data={accessToken:'qa'};
   if(p.endsWith('/auth/me'))data={id:1,nombreCompleto:'QA',roles:[{clave:'SUPERADMIN'}]};
   if(p.endsWith('/academico/ciclos'))data=[grupo.ciclo];
   if(p.endsWith('/planteles/mios'))data=[grupo.plantel];
   if(p.endsWith('/academico/materias'))data=Array.from({length:1000},(_,i)=>({id:i+1,clave:'MAT'+i,nombre:'Materia de prueba '+i,creditos:6}));
   if(p.endsWith('/academico/grupos')||p.endsWith('/academico/grupos/preparacion'))data={datos:[{...grupo,preparacion:{asignadas:0,sinDocente:0,inscritos:0,esperadas:null,pendientes:null}}],total:1,pagina:1,porPagina:10};
   if(p.includes('/academico/')||p.endsWith('/planteles/mios'))llamadas.push({ruta:p,bytes:Buffer.byteLength(JSON.stringify(data))});
   await new Promise(r=>setTimeout(r,40));await route.fulfill({json:data});
  });
  const inicio=performance.now();await page.goto(base+'/grupos?vista=consulta');await expect(page.getByRole('button',{name:'Administrar',exact:true})).toBeVisible();
  await expect(page.getByText('Cargando catálogos…',{exact:true})).toHaveCount(0);
  resultados.push({ms:Math.round(performance.now()-inicio),peticiones:llamadas.length,bytes:llamadas.reduce((s,r)=>s+r.bytes,0),rutas:llamadas.map(x=>x.ruta)});await page.close();
 }
 const tiempos=resultados.map(r=>r.ms).sort((a,b)=>a-b);const informe={escenario:'Grupos, 1 grupo y catálogo de 1000 materias, 40 ms simulados por respuesta',medianaMs:tiempos[2],muestras:resultados};
 console.log(JSON.stringify(informe,null,2));if(process.env.MEDICION_SALIDA)writeFileSync(process.env.MEDICION_SALIDA,JSON.stringify(informe,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.kill('SIGTERM');});
