const fs = require('node:fs');
const path = require('node:path');

// Este módulo funciona dentro del runner Playwright con respuestas de prueba.
// Nunca usa URLs institucionales ni lee expedientes de alumnos.
async function ejecutarAuditoria(page, baseUrl) {
  const axe = require('axe-core');
  const rutas = [
    { nombre: 'acceso', ruta: '/login' },
    { nombre: 'inicio', ruta: '/' },
    { nombre: 'expedientes', ruta: '/alumnos' },
    { nombre: 'finanzas', ruta: '/finanzas' },
  ];
  const hallazgos = [];
  for (const paso of rutas) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(baseUrl + paso.ruta);
    if (paso.nombre === 'inicio') await page.locator('.panel-bienvenida').waitFor();
    if (paso.nombre === 'expedientes') {
      await page.getByRole('button', { name: /Registrar alumno/ }).click();
      await page.locator('#form-alumno').waitFor();
    }
    await page.addScriptTag({ content: axe.source });
    const resultado = await page.evaluate(async () => {
      const informe = await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
      });
      return informe.violations.map(v => ({
        id: v.id, impacto: v.impact || 'sin-clasificar',
        descripcion: v.help, referencia: v.helpUrl,
        nodos: v.nodes.length,
        selectores: v.nodes.slice(0, 5).map(n => n.target.join(' ')),
      }));
    });
    hallazgos.push({ pantalla: paso.nombre, ruta: paso.ruta, violaciones: resultado });
    console.log('A11Y ' + paso.nombre + ': ' + resultado.length + ' reglas con incidencias');
  }
  const archivo = path.resolve(__dirname, '../.qa/axe-report.json');
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  fs.writeFileSync(archivo, JSON.stringify({
    tipo: 'WCAG automatizado / API simulada',
    fecha: new Date().toISOString(),
    escenarios: hallazgos,
    pendientes: ['lector de pantalla humano', 'teclado completo', 'UAT institucional'],
  }, null, 2));
  const graves = hallazgos.flatMap(r => r.violaciones.filter(v =>
    v.impacto === 'critical' || v.impacto === 'serious',
  ));
  if (process.env.A11Y_STRICT === '1' && graves.length) {
    throw new Error('axe: ' + graves.length + ' hallazgos graves. Consultar .qa/axe-report.json');
  }
  console.log('Reporte axe guardado: .qa/axe-report.json; sin UAT ni certificación automática');
}
module.exports = { ejecutarAuditoria };
