import * as ExcelJS from 'exceljs';
import type { DatosActa, DatosBoleta } from './formatos-escolares.service';
export interface LogoDocumento { buffer:Buffer; extension:'png'|'jpeg' }
function logoEnHoja(wb:ExcelJS.Workbook,ws:ExcelJS.Worksheet,logo?:LogoDocumento){if(!logo)return;const id=wb.addImage({buffer:logo.buffer as never,extension:logo.extension});ws.addImage(id,{tl:{col:0,row:0},ext:{width:60,height:55}});}
function crear(nombre:string, anchos:number[]) {
 const wb=new ExcelJS.Workbook();wb.creator='Sistema Escolar';
 const ws=wb.addWorksheet(nombre,{pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0},views:[{state:'frozen',ySplit:7}]});
 anchos.forEach((width,i)=>ws.getColumn(i+1).width=width);ws.headerFooter.oddFooter='Página &P de &N';return {wb,ws};
}
function texto(ws:ExcelJS.Worksheet,fila:number,desde:number,hasta:number,valor:string) {
 if(hasta>desde)ws.mergeCells(fila,desde,fila,hasta);const c=ws.getCell(fila,desde);c.value=valor;c.font={name:'Arial',size:11,bold:fila<3};c.alignment={wrapText:true,vertical:'middle'};ws.getRow(fila).height=30;
}
function tabla(ws:ExcelJS.Worksheet,fila:number,valores:ExcelJS.CellValue[],cabecera=false){
 valores.forEach((v,i)=>{const c=ws.getCell(fila,i+1);c.value=v;c.font={name:'Arial',size:10,bold:cabecera};c.alignment={wrapText:true,vertical:'middle'};
 c.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};if(cabecera)c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE7E6E6'}};});ws.getRow(fila).height=cabecera?48:36;
}
export async function crearActaExcel(d:DatosActa,plantilla:boolean,logo?:LogoDocumento):Promise<Buffer>{
 const {wb,ws}=crear('Acta',[6,19,44,...Array<number>(16).fill(4),8,14,12,14,28]);
 logoEnHoja(wb,ws,logo);texto(ws,1,logo?3:1,24,d.institucion);texto(ws,2,logo?3:1,24,'COORDINACIÓN DE CONTROL ESCOLAR · LISTAS DE EVALUACIÓN PARCIAL');
 texto(ws,3,1,12,`PLAN DE ESTUDIOS: ${d.plan}`);texto(ws,3,13,24,`PERIODO: ${d.periodo} · CICLO: ${d.ciclo}`);
 texto(ws,4,1,12,`ASIGNATURA: ${d.asignatura}`);texto(ws,4,13,24,`PROFESOR(A): ${d.docente}`);
 texto(ws,5,1,24,`PLANTEL: ${d.plantel} · GRUPO: ${d.grupo} · ${d.evaluacion} · ESCALA: ${d.escala}`);
 texto(ws,6,1,24,`${plantilla?'PLANTILLA PARA RELLENAR':'DATOS REGISTRADOS'} · ASISTENCIAS = ( . ) · INASISTENCIAS = ( F )`);
 tabla(ws,7,['N° Lista','Matrícula','Nombre del alumno',...Array.from({length:16},(_,i)=>`Día ${i+1}`),'Faltas','Evaluación continua','Examen','Calificación parcial','Observaciones'],true);
 d.filas.forEach((f,i)=>{const r=i+8;tabla(ws,r,[i+1,f.matricula,f.nombre,...Array<string>(16).fill(''),'','','',plantilla?'':f.calificacion??'',plantilla?'':f.observaciones]);
 for(let col=4;col<=24;col++)if(plantilla||col<23)ws.getCell(r,col).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF2CC'}};
 for(let col=4;col<=19;col++)ws.getCell(r,col).dataValidation={type:'list',allowBlank:true,formulae:['".,F"']};
 ws.getCell(r,23).dataValidation={type:'decimal',operator:'between',formulae:[0,100],allowBlank:true,showErrorMessage:true,error:'Escala vigente: 0 a 100.'};});
 const pie=d.filas.length+10;
 ['FIRMA PROFESOR(A)','FIRMA DEL COORDINADOR(A)','FIRMA DE CONTROL ESCOLAR'].forEach((v,i)=>{texto(ws,pie,1+i*8,8+i*8,'____________________________');texto(ws,pie+1,1+i*8,8+i*8,v);});
 const ayuda=wb.addWorksheet('Instrucciones');ayuda.getColumn(1).width=120;
 [d.aviso,'Las casillas de asistencia son espacios de trabajo manual; sus fechas se rellenan en Excel. No calculan faltas ni promedios.',
 'Este acta no es la plantilla de importación. Para cargar notas al sistema usa la plantilla de importación de Calificaciones, previsualiza y confirma.',
 'Sin firmas electrónicas ni sello. No se convierte la escala. No se inventa fórmula de evaluación continua y examen.'].forEach(v=>{const r=ayuda.addRow([v]);r.height=48;r.getCell(1).alignment={wrapText:true};});
 ws.pageSetup.printTitlesRow='1:7';ws.pageSetup.printArea=`A1:X${pie+1}`;return Buffer.from(await wb.xlsx.writeBuffer());
}
export async function crearBoletaExcel(d:DatosBoleta,logo?:LogoDocumento):Promise<Buffer>{
 const {wb,ws}=crear('Boleta',[6,15,40,12,14,17,14,30]);
 logoEnHoja(wb,ws,logo);texto(ws,1,logo?3:1,8,d.institucion);texto(ws,2,logo?3:1,8,'BOLETA INFORMATIVA DE CALIFICACIONES FINALES');
 texto(ws,3,1,4,`PLANTEL: ${d.plantel}`);texto(ws,3,5,8,`PLAN DE ESTUDIOS: ${d.plan}`);
 texto(ws,4,1,8,`NOMBRE DEL ALUMNO: ${d.alumno}`);texto(ws,5,1,4,`MATRÍCULA: ${d.matricula}`);texto(ws,5,5,8,`PERIODO: ${d.periodo} · GRUPO: ${d.grupo}`);
 texto(ws,6,1,8,`${d.disponible?'DATOS COMPLETOS':'BORRADOR — CAPTURA O CIERRE PENDIENTE'} · ESCALA: ${d.escala}`);
 tabla(ws,7,['N°','Clave','Asignatura','Créditos','Seriación','Ciclo escolar','Prom. final','Observaciones'],true);
 d.filas.forEach((f,i)=>{tabla(ws,i+8,[i+1,f.clave,f.asignatura,f.creditos,f.seriacion,f.ciclo,f.promedioFinal??'',f.observaciones]);ws.getCell(i+8,4).numFmt='0.00';ws.getCell(i+8,7).numFmt='0.0';});
 const pie=d.filas.length+9;texto(ws,pie,1,6,'PROMEDIO GENERAL');ws.getCell(pie,7).value=d.promedioGeneral??'';ws.getCell(pie,7).numFmt='0.0';
 texto(ws,pie+2,1,8,d.aviso);ws.getRow(pie+2).height=48;texto(ws,pie+4,2,8,'____________________________________________________________');texto(ws,pie+5,2,8,'SELLO Y FIRMA DEL COORDINADOR DE SERVICIOS ESCOLARES');
 ws.pageSetup.printTitlesRow='1:7';ws.pageSetup.printArea=`A1:H${pie+5}`;return Buffer.from(await wb.xlsx.writeBuffer());
}
