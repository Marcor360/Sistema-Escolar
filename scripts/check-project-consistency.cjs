// Contrasta archivos reales: versiones, migraciones espejo, enlaces README y rutas de clientes/API.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../backend/node_modules/typescript');
const root = path.resolve(__dirname, '..');
const leer = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const json = (p) => JSON.parse(leer(p));
const errores = [];
const exigir = (ok, mensaje) => { if (!ok) errores.push(mensaje); };
const version = json('backend/package.json').version;
for (const area of ['backend', 'web', 'mobile']) {
  exigir(json(`${area}/package.json`).version === version, `${area}: versión divergente`);
  const lock = json(`${area}/package-lock.json`);
  exigir(lock.version === version && lock.packages[''].version === version, `${area}: lockfile divergente`);
}
exigir(json('mobile/app.json').expo.version === version, 'Expo: versión divergente');
exigir(leer('README.md').includes(`Versión candidata: \`${version}\``), 'README: versión candidata divergente');
const manifest = json('database/baseline-manifest.json');
for (const motor of ['mysql', 'sqlserver']) {
  const configuracion = manifest.motores[motor];
  const nombres = [...configuracion.incluye, ...configuracion.pendientes];
  const archivos = fs.readdirSync(path.join(root, 'database', motor)).filter((f) => /^migracion_.*\.sql$/.test(f)).sort();
  exigir(new Set(nombres).size === nombres.length, `${motor}: migración duplicada`);
  exigir(JSON.stringify([...nombres].sort()) === JSON.stringify(archivos), `${motor}: manifest y archivos de migración divergen`);
  exigir(fs.existsSync(path.join(root, configuracion.archivo)), `${motor}: baseline inexistente`);
}
for (const campo of ['incluye', 'pendientes']) exigir(JSON.stringify(manifest.motores.mysql[campo]) === JSON.stringify(manifest.motores.sqlserver[campo]), `Migraciones espejo: ${campo} divergente`);
for (const enlace of leer('README.md').matchAll(/\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)) {
  const destino = enlace[1].split('#')[0];
  if (destino && !/^(https?:|mailto:|app:|\/)/.test(destino)) exigir(fs.existsSync(path.resolve(root, destino)), `README: enlace inexistente ${destino}`);
}
function archivos(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((f) => f.isDirectory() ? archivos(path.join(dir, f.name)) : /\.[jt]sx?$/.test(f.name) ? [path.join(dir, f.name)] : []); }
const decoradores = (n) => ts.canHaveDecorators(n) ? ts.getDecorators(n) || [] : [];
const texto = (n) => n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : undefined;
const rutas = [];
for (const f of archivos(path.join(root, 'backend/src')).filter((f) => f.endsWith('controller.ts'))) {
  const source = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
  for (const clase of source.statements.filter(ts.isClassDeclaration)) {
    const controlador = decoradores(clase).find((d) => ts.isCallExpression(d.expression) && d.expression.expression.getText(source) === 'Controller');
    if (!controlador) continue;
    const prefijo = texto(controlador.expression.arguments[0]) || '';
    for (const miembro of clase.members) for (const d of decoradores(miembro)) {
      if (!ts.isCallExpression(d.expression)) continue;
      const metodo = d.expression.expression.getText(source).toLowerCase();
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(metodo)) continue;
      rutas.push({ metodo, ruta: `/${prefijo}/${texto(d.expression.arguments[0]) || ''}`.replace(/\/+$/, '').replace(/\/{2,}/g, '/') });
    }
  }
}
let consultas = 0;
for (const f of [...archivos(path.join(root, 'web/src')), ...archivos(path.join(root, 'mobile/src')), path.join(root, 'mobile/App.tsx')].filter((f) => !/\.(test|spec)\./.test(f))) {
  const source = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
  function visitar(n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.expression.getText(source) === 'api' && ['get','post','put','patch','delete'].includes(n.expression.name.text)) {
      const ruta = n.arguments[0];
      const patrones = [];
      function obtener(x) {
        const literal = texto(x);
        if (literal !== undefined && literal.startsWith('/')) patrones.push(literal);
        else if (ts.isTemplateExpression(x) && x.head.text.startsWith('/')) patrones.push(x.head.text + x.templateSpans.map((s) => '{param}' + s.literal.text).join(''));
        else if (ts.isConditionalExpression(x)) { obtener(x.whenTrue); obtener(x.whenFalse); }
      }
      if (ruta) obtener(ruta);
      for (const patron of patrones) {
        consultas++;
        const base = patron.split('?')[0].replace(/\/+$/, '');
        const partes = base.split('/');
        const encontrado = rutas.some((r) => r.metodo === n.expression.name.text && r.ruta.split('/').length === partes.length && r.ruta.split('/').every((p,i) => p.startsWith(':') || partes[i] === '{param}' || p === partes[i]));
        exigir(encontrado, `${path.relative(root,f)}: ${n.expression.name.text.toUpperCase()} ${patron} sin contrato backend`);
      }
    }
    ts.forEachChild(n, visitar);
  }
  visitar(source);
}
if (errores.length) { console.error(errores.join('\n')); process.exitCode = 1; }
else console.log(`Consistencia ${version}: versiones, baseline/migraciones espejo, enlaces README y ${consultas} consultas de cliente contrastadas con ${rutas.length} rutas API.`);
