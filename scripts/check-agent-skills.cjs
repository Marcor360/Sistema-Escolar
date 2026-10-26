// Validador sin dependencias externas de skills locales IUA.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const base = path.join(root, '.agents', 'skills');
const NOMBRE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validarSkill(directorio, texto) {
  const errores = [];
  const front = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(texto);
  if (!front) return ['Falta encabezado YAML delimitado por ---'];
  const nombre = /^name:\s*(\S+)\s*$/m.exec(front[1])?.[1];
  const descripcion = /^description:\s*(.+)\s*$/m.exec(front[1])?.[1]?.trim();
  if (!nombre || !NOMBRE.test(nombre)) errores.push('name inválido o ausente');
  if (nombre !== directorio) errores.push('name no coincide con el directorio');
  if (!descripcion || descripcion.length < 35 || descripcion.length > 300) errores.push('description ausente o demasiado corta/larga');
  if (texto.slice(front[0].length).trim().length < 150) errores.push('Skill sin instrucciones suficientes');
  return errores;
}

function auditar(raiz = base) {
  if (!fs.existsSync(raiz)) return ['No existe .agents/skills'];
  const errores = [];
  const directorios = fs.readdirSync(raiz, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  if (directorios.length === 0) return ['No hay skills'];
  const nombres = new Set();
  for (const dir of directorios) {
    const ruta = path.join(raiz, dir.name, 'SKILL.md');
    if (!fs.existsSync(ruta)) { errores.push(dir.name + ': falta SKILL.md'); continue; }
    const contenido = fs.readFileSync(ruta, 'utf8');
    for (const error of validarSkill(dir.name, contenido)) errores.push(dir.name + ': ' + error);
    const nombre = /^name:\s*(\S+)/m.exec(contenido)?.[1];
    if (nombre && nombres.has(nombre)) errores.push('Nombre duplicado: ' + nombre);
    nombres.add(nombre);
  }
  return errores;
}

if (require.main === module) {
  const problemas = auditar();
  if (problemas.length) { console.error(problemas.join('\n')); process.exitCode = 1; }
  else console.log('Skills IUA válidas: formato, nombres y descripciones.');
}
module.exports = { validarSkill, auditar };
