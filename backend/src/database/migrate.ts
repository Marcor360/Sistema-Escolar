import { ConfigService } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { typeOrmConfig } from '../config/typeorm.config';

type Motor = 'mysql' | 'mssql';
type Manifiesto = { baseline: string; motores: Record<Motor, { incluye: string[]; pendientes: string[] }> };

const root = resolve(process.cwd(), '..');
const motor = (process.env.DB_TYPE || 'mysql') as Motor;
if (!['mysql', 'mssql'].includes(motor)) throw new Error('DB_TYPE debe ser mysql o mssql');
if (process.env.DB_SYNC !== 'false') throw new Error('Seguridad: define DB_SYNC=false para ejecutar el runner');
if (!process.env.DB_NAME) throw new Error('Define DB_NAME explícitamente para ejecutar migraciones');

const manifestPath = join(root, 'database', 'baseline-manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifiesto;
const included = manifest.motores[motor === 'mysql' ? 'mysql' : 'sqlserver'].incluye;
const pendingOrder = manifest.motores[motor === 'mysql' ? 'mysql' : 'sqlserver'].pendientes;
const migrationDir = join(root, 'database', motor === 'mysql' ? 'mysql' : 'sqlserver');
const tableName = 'schema_migrations';

function quoteName(value: string): string {
  if (motor === 'mysql') return `\`${value}\``;
  return `[${value}]`;
}

function splitSql(content: string): string[] {
  if (motor === 'mssql') {
    return content.split(/^\s*GO\s*$/im).map((part) => part.trim()).filter(Boolean);
  }
  const chunks: string[] = [];
  let current = '';
  let quote = '';
  let lineComment = false;
  let blockComment = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];
    if (lineComment) {
      current += char;
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      current += char;
      if (char === '*' && next === '/') { current += next; i++; blockComment = false; }
      continue;
    }
    if (quote) {
      current += char;
      if (char === quote && next === quote) { current += next; i++; }
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '-' && next === '-') { current += char + next; i++; lineComment = true; continue; }
    if (char === '/' && next === '*') { current += char + next; i++; blockComment = true; continue; }
    if (char === "'" || char === '"' || char === '`') { quote = char; current += char; continue; }
    if (char === ';') {
      const statement = current.trim();
      if (statement) chunks.push(statement);
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function tableExists(source: DataSource): Promise<boolean> {
  if (motor === 'mysql') {
    const rows = await source.query('SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?', [tableName]);
    return Number(rows[0].total) > 0;
  }
  const rows = await source.query('SELECT COUNT(*) AS total FROM sys.tables WHERE name = @0', [tableName]);
  return Number(rows[0].total) > 0;
}

async function createHistory(source: DataSource): Promise<void> {
  if (motor === 'mysql') {
    await source.query('CREATE TABLE schema_migrations (migration_id VARCHAR(190) NOT NULL PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB');
  } else {
    await source.query('CREATE TABLE schema_migrations (migration_id NVARCHAR(190) NOT NULL PRIMARY KEY, applied_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME())');
  }
}

async function listBaseTables(source: DataSource): Promise<number> {
  if (motor === 'mysql') {
    const rows = await source.query("SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'");
    return Number(rows[0].total);
  }
  const rows = await source.query('SELECT COUNT(*) AS total FROM sys.tables');
  return Number(rows[0].total);
}

async function isApplied(source: DataSource, migration: string): Promise<boolean> {
  const rows = await source.query(`SELECT migration_id FROM ${quoteName(tableName)} WHERE migration_id = ${motor === 'mysql' ? '?' : '@0'}`, [migration]);
  return rows.length > 0;
}

async function record(source: DataSource, migration: string): Promise<void> {
  await source.query(`INSERT INTO ${quoteName(tableName)} (migration_id) VALUES (${motor === 'mysql' ? '?' : '@0'})`, [migration]);
}

async function run(): Promise<void> {
  const action = process.argv[2] || 'up';
  const config = new ConfigService(process.env);
  const source = new DataSource(typeOrmConfig(config) as DataSourceOptions);
  await source.initialize();
  try {
    if (action === 'adopt') {
      if (process.env.DB_MIGRATION_BASELINE !== manifest.baseline) {
        throw new Error(`Para adoptar el esquema revisado, define DB_MIGRATION_BASELINE=${manifest.baseline}`);
      }
      if (await tableExists(source)) throw new Error('Ya existe schema_migrations; no se puede adoptar de nuevo');
      if (await listBaseTables(source) === 0) throw new Error('La base está vacía. Instala un baseline aprobado antes de adoptarlo.');
      await createHistory(source);
      await record(source, `baseline:${manifest.baseline}`);
      for (const filename of included) await record(source, filename);
      console.log(`Registrado baseline:${manifest.baseline} y ${included.length} migraciones incluidas. Verifica previamente que la base realmente coincide con el manifest.`);
      return;
    }

    if (action !== 'up' && action !== 'status') throw new Error('Uso: npm run db:migrate -- [up|status|adopt]');
    if (!(await tableExists(source))) {
      const tables = await listBaseTables(source);
      if (tables) throw new Error('La base tiene tablas pero carece de historial. Revisa el esquema y adopta explícitamente con DB_MIGRATION_BASELINE=v1 npm run db:migrate:adopt.');
      throw new Error('La base está vacía. Instala un baseline aprobado antes de ejecutar el runner.');
    }
    if (!(await isApplied(source, `baseline:${manifest.baseline}`))) throw new Error('El historial no identifica un baseline compatible. No se ejecutarán migraciones.');

    const applied = new Set<string>();
    const allFiles = readdirSync(migrationDir).filter((name) => /^migracion_.*\.sql$/i.test(name));
    const untracked = allFiles.filter((name) => !included.includes(name) && !pendingOrder.includes(name));
    if (untracked.length) throw new Error(`Registra las migraciones nuevas en database/baseline-manifest.json: ${untracked.join(', ')}`);
    for (const filename of pendingOrder) {
      if (!existsSync(join(migrationDir, filename))) throw new Error(`No se encontró la migración declarada: ${filename}`);
      if (included.includes(filename) || await isApplied(source, filename)) { applied.add(filename); continue; }
      if (action === 'status') { console.log(`Pendiente: ${filename}`); continue; }
      const content = readFileSync(join(migrationDir, filename), 'utf8');
      for (const statement of splitSql(content)) await source.query(statement);
      await record(source, filename);
      applied.add(filename);
      console.log(`Aplicada: ${filename}`);
    }
    if (action === 'status') {
      const pendientes = pendingOrder.filter((name) => !included.includes(name) && !applied.has(name));
      if (!pendientes.length) console.log('Sin migraciones pendientes.');
    }
  } finally {
    await source.destroy();
  }
}

if (!existsSync(manifestPath)) throw new Error(`No se encontró ${manifestPath}`);
run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
