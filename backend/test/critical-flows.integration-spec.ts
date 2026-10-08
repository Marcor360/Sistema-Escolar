import { ContextoIntegracion } from './integration/contexto';
import { casos_baseline } from './integration/baseline.cases';
import { casos_identidad } from './integration/identidad.cases';
import { casos_academico } from './integration/academico.cases';
import { casos_calificaciones } from './integration/calificaciones.cases';
import { casos_finanzas } from './integration/finanzas.cases';
import { casos_archivos } from './integration/archivos.cases';
import { casos_calendario } from './integration/calendario.cases';
import { casos_conducta } from './integration/conducta.cases';
import { casos_analitica } from './integration/analitica.cases';
import { casos_importaciones } from './integration/importaciones.cases';
import { casos_roles } from './integration/roles.cases';
import { CobranzaService } from '../src/finanzas/cobranza.service';
import { PushService } from '../src/notificaciones/push.service';
import { NotificacionesService } from '../src/notificaciones/notificaciones.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { NestFactory } from '@nestjs/core';
import * as ExcelJS from 'exceljs';
import { BitacoraFinanciera } from '../src/entities/bitacora-financiera.entity';
import { AuthService } from '../src/auth/auth.service';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { AddressInfo } from 'net';
import { basename, resolve } from 'path';
import { readdirSync, existsSync, readFileSync, unlinkSync } from 'fs';
import { spawn, spawnSync } from 'child_process';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import {
  Alumno, Calificacion, Cargo, CicloEscolar, ConceptoPago, Grupo, GrupoMateria, Inscripcion,
  PlantillaCorreo, CobranzaEnvio, BitacoraAcademica, PushDispositivo, PushEnvio, Docente, Entrega, Materia, Material, Notificacion, OrdenPago, Pago, Plantel, Rol, Usuario, UsuarioPlantel,
} from '../src/entities';
import { AppModule } from '../src/app.module';
import { BitacoraFinancieraService } from '../src/finanzas/bitacora-financiera.service';

const dbName = process.env.DB_NAME ?? '';

function ejecutarRunnerMigraciones(accion: 'adopt' | 'up' | 'status'): string {
  const resultado = spawnSync(process.execPath, [
    '-r', 'ts-node/register', '-r', 'tsconfig-paths/register',
    'src/database/migrate.ts', accion,
  ], {
    cwd: resolve(process.cwd()),
    encoding: 'utf8',
    env: { ...process.env, DB_SYNC: 'false', DB_MIGRATION_BASELINE: 'v1' },
  });
  if (resultado.status !== 0) {
    throw new Error(`Falló el runner de migraciones (${accion}): ${resultado.stderr || resultado.stdout}`);
  }
  return resultado.stdout;
}

function ejecutarRunnerMigracionesAsync(accion: 'up'): Promise<{ status: number | null; output: string }> {
  return new Promise((resolveProceso, rejectProceso) => {
    const proceso = spawn(process.execPath, [
      '-r', 'ts-node/register', '-r', 'tsconfig-paths/register',
      'src/database/migrate.ts', accion,
    ], {
      cwd: resolve(process.cwd()),
      env: { ...process.env, DB_SYNC: 'false', DB_MIGRATION_BASELINE: 'v1' },
    });
    let output = '';
    proceso.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    proceso.stderr.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    proceso.once('error', rejectProceso);
    proceso.once('close', (status) => resolveProceso({ status, output }));
  });
}

async function verificarRunnerConcurrente(): Promise<void> {
  const resultados = await Promise.all([
    ejecutarRunnerMigracionesAsync('up'),
    ejecutarRunnerMigracionesAsync('up'),
  ]);
  expect(resultados.map(({ status }) => status)).toEqual([0, 0]);
}

async function esperarYCrearBaseSqlServer(): Promise<void> {
  const sql = require('mssql');
  const opciones = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT) || 1433,
    database: 'master',
    options: { encrypt: false, trustServerCertificate: true },
    connectionTimeout: 5000,
  };
  let pool: any;
  let ultimoError: unknown;
  for (let intento = 0; intento < 30; intento++) {
    try {
      pool = await sql.connect(opciones);
      break;
    } catch (error) {
      ultimoError = error;
      await new Promise((resolveEspera) => setTimeout(resolveEspera, 2000));
    }
  }
  if (!pool) throw ultimoError;
  try {
    await pool.request().query(`IF DB_ID(N'${dbName}') IS NULL CREATE DATABASE [${dbName}]`);
  } finally {
    await pool.close();
  }
}

const ledgerLegacyFixture = `
  INSERT INTO planteles (clave,nombre) VALUES ('MIGRACION_B','Plantel actual tras transferencia');
  INSERT INTO usuarios (email,password_hash,nombre,apellido_paterno,activo) VALUES ('ledger_migracion@example.invalid','fixture-sin-acceso','Histórico','Migración',0);
  INSERT INTO alumnos (usuario_id,plantel_id,matricula)
    SELECT u.id,p.id,'MIGRACION_LEDGER' FROM usuarios u CROSS JOIN planteles p WHERE u.email='ledger_migracion@example.invalid' AND p.clave='MIGRACION_B';
  INSERT INTO conceptos_pago (clave,nombre,tipo,monto_base) VALUES ('MIGRACION_LEDGER','Cargo antiguo','OTRO',100);
  INSERT INTO cargos (alumno_id,concepto_id,descripcion,monto)
    SELECT a.id,c.id,'LEDGER_PREVIO',100 FROM alumnos a CROSS JOIN conceptos_pago c WHERE a.matricula='MIGRACION_LEDGER' AND c.clave='MIGRACION_LEDGER';
  INSERT INTO bitacora_financiera (plantel_id,accion,entidad,entidad_id,detalle)
    SELECT p.id,'CREAR_CARGO','cargo',c.id,'Origen antes de transferir' FROM planteles p CROSS JOIN cargos c WHERE p.clave='MIGRACION_FIXTURE' AND c.descripcion='LEDGER_PREVIO';
  INSERT INTO ordenes_pago (alumno_id,cargo_id,monto,descripcion)
    SELECT alumno_id,id,25,'LEDGER_PREVIO' FROM cargos WHERE descripcion='LEDGER_PREVIO';
  INSERT INTO pagos (alumno_id,cargo_id,orden_pago_id,monto,metodo)
    SELECT alumno_id,cargo_id,id,25,'PASARELA' FROM ordenes_pago WHERE descripcion='LEDGER_PREVIO';
`;

async function instalarBaseline(): Promise<void> {
  const raiz = resolve(process.cwd(), '..');
  if (process.env.DB_TYPE === 'mssql') {
    const sql = require('mssql');
    const pool = await new sql.ConnectionPool({
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      server: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT) || 1433,
      database: dbName,
      options: { encrypt: process.env.DB_ENCRYPT === 'true', trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true' },
      connectionTimeout: 10000,
    }).connect();
    try {
      const contenido = readFileSync(resolve(raiz, 'database/sqlserver/baseline_v1.sql'), 'utf8');
      const tablas = await pool.request().query('SELECT COUNT(*) AS total FROM sys.tables');
      if (tablas.recordset[0].total !== 0) throw new Error('La base de integración SQL Server no está vacía');
      for (const lote of contenido.split(/^\s*GO\s*$/im).map((parte: string) => parte.trim()).filter(Boolean)) {
        await pool.request().query(lote);
      }
      await pool.request().query(`
        INSERT INTO planteles (clave, nombre) VALUES ('MIGRACION_FIXTURE', 'Plantel previo a migración');
        INSERT INTO ciclos_escolares (clave, nombre, fecha_inicio, fecha_fin, activo)
          VALUES ('MIGRACION_FIXTURE', 'Ciclo previo a migración', '2026-08-01', '2027-07-31', 0);
        INSERT INTO grupos (ciclo_id, plantel_id, nombre)
          SELECT c.id, p.id, 'GRUPO_MIGRACION_EXISTENTE'
          FROM ciclos_escolares c CROSS JOIN planteles p
          WHERE c.clave = 'MIGRACION_FIXTURE' AND p.clave = 'MIGRACION_FIXTURE';
      `);
      await pool.request().query(ledgerLegacyFixture);
    } finally {
      await pool.close();
    }
    ejecutarRunnerMigraciones('adopt');
    ejecutarRunnerMigraciones('up');
    expect(ejecutarRunnerMigraciones('status')).toContain('Sin migraciones pendientes');
    await verificarRunnerConcurrente();
    return;
  }

  const mysql = require('mysql2/promise');
  const conexion = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: dbName,
    multipleStatements: true,
  });
  try {
    const [tablas] = await conexion.query(
      'SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE()',
    );
    if (Number(tablas[0].total) !== 0) throw new Error('La base de integración MySQL no está vacía');
    const contenido = readFileSync(resolve(raiz, 'database/mysql/baseline_v1.sql'), 'utf8');
    await conexion.query(contenido);
    await conexion.query(`
      INSERT INTO planteles (clave, nombre) VALUES ('MIGRACION_FIXTURE', 'Plantel previo a migración');
      INSERT INTO ciclos_escolares (clave, nombre, fecha_inicio, fecha_fin, activo)
        VALUES ('MIGRACION_FIXTURE', 'Ciclo previo a migración', '2026-08-01', '2027-07-31', 0);
      INSERT INTO grupos (ciclo_id, plantel_id, nombre)
        SELECT c.id, p.id, 'GRUPO_MIGRACION_EXISTENTE'
        FROM ciclos_escolares c CROSS JOIN planteles p
        WHERE c.clave = 'MIGRACION_FIXTURE' AND p.clave = 'MIGRACION_FIXTURE'
    `);
    await conexion.query(ledgerLegacyFixture);
  } finally {
    await conexion.end();
  }
  ejecutarRunnerMigraciones('adopt');
  ejecutarRunnerMigraciones('up');
  expect(ejecutarRunnerMigraciones('status')).toContain('Sin migraciones pendientes');
  await verificarRunnerConcurrente();
}

describe('Integración de flujos críticos (base aislada)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let baseUrl: string;
  let sufijo: string;
  let plantelId: number;
  let otroPlantelId: number;
  let adminId: number;
  let finanzasId: number;
  let superadminId: number;
  let alumnoId: number;
  let alumnoUsuarioId: number;
  let grupoMateriaIdMaestro: number;
  let docenteFueraDeAlcanceId: number;
  let ordenId: number;
  let cargoWebhookId: number;
  let archivoPrueba: string | undefined;

  const api = async (
    ruta: string,
    opciones: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {},
  ) => {
    const headers: Record<string, string> = { ...opciones.headers };
    if (opciones.token) headers.authorization = `Bearer ${opciones.token}`;
    let body: BodyInit | undefined;
    if (opciones.body instanceof FormData) body = opciones.body;
    else if (opciones.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(opciones.body);
    }
    const response = await fetch(`${baseUrl}${ruta}`, { method: opciones.method ?? 'GET', headers, body });
    const texto = await response.text();
    let data: any = null;
    try { data = texto ? JSON.parse(texto) : null; } catch { data = texto; }
    return { response, data };
  };

  const passwords = new Map<string, string>();
  const emitirToken = async (email: string) => {
    const usuario = await dataSource.getRepository(Usuario).findOneOrFail({
      where: { email },
      relations: ['roles'],
    });
    if (usuario.passwordChangeRequired) {
      await app.get(AuthService).cambiarPassword(usuario.id, passwords.get(email) ?? 'Integracion_Segura_42!', 'Integracion_Renovada_42!');
      passwords.set(email, 'Integracion_Renovada_42!');
    }
    return (await app.get(AuthService).login(email, passwords.get(email) ?? 'Integracion_Segura_42!',
      usuario.roles.some((r) => r.clave === 'ALUMNO') ? 'MOVIL' : 'WEB')).accessToken;
  };

  const emitirFinanzasB = async () => {
    const email = `finanzas_b_${sufijo}@example.invalid`;
    if (!await dataSource.getRepository(Usuario).findOneBy({ email })) {
      const root = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: superadminId })).email);
      const creado = await api('/usuarios', { method: 'POST', token: root, body: { email, password: 'Integracion_Segura_42!', nombre: 'Finanzas', apellidoPaterno: 'Plantel B', roles: ['FINANZAS'], plantelIds: [otroPlantelId] } });
      expect(creado.response.status).toBe(201);
    }
    return emitirToken(email);
  };

  beforeAll(async () => {
    if (process.env.RUN_DB_INTEGRATION !== '1') {
      throw new Error('Define RUN_DB_INTEGRATION=1 para habilitar pruebas contra la base aislada');
    }
    if (!/^escolar_integration_[a-z0-9_]+$/i.test(dbName)) {
      throw new Error('DB_NAME debe comenzar con escolar_integration_; se rechaza cualquier otra base');
    }
    if (process.env.DB_SYNC !== 'false' || process.env.NODE_ENV === 'production') {
      throw new Error('La integración exige DB_SYNC=false y una base aislada con baseline instalado');
    }
    process.env.NODE_ENV = 'test';
    process.env.PUSH_ENABLED = 'false'; process.env.SMTP_HOST = '';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'solo-para-pruebas-integrales';
    process.env.UPLOADS_DIR = process.env.UPLOADS_DIR || 'uploads';
    if (process.env.DB_TYPE === 'mssql') await esperarYCrearBaseSqlServer();
    await instalarBaseline();

    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    if (process.env.RUN_WEB_E2E === '1') { process.env.CORS_ORIGINS = 'http://127.0.0.1:5181,http://localhost:5173'; app.enableCors({ origin: process.env.CORS_ORIGINS.split(','), credentials: true }); }
    app.setGlobalPrefix('api', { exclude: [{ path: 'uploads/:filename', method: RequestMethod.GET }] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api`;
    dataSource = app.get(DataSource);

    sufijo = `${Date.now().toString(36)}${Math.floor(Math.random() * 10000).toString(36)}`;
    const planteles = dataSource.getRepository(Plantel);
    const plantel = await planteles.save(planteles.create({ clave: `P${sufijo}`, nombre: 'Plantel de integración' }));
    const otro = await planteles.save(planteles.create({ clave: `Q${sufijo}`, nombre: 'Otro plantel' }));
    plantelId = plantel.id;
    otroPlantelId = otro.id;

    const rolesRepo = dataSource.getRepository(Rol);
    const obtenerRol = async (clave: string, nombre: string) => {
      const existente = await rolesRepo.findOneBy({ clave });
      return existente ?? rolesRepo.save(rolesRepo.create({ clave, nombre }));
    };
    const administrativo = await obtenerRol('ADMINISTRATIVO', 'Administrativo');
    const finanzas = await obtenerRol('FINANZAS', 'Finanzas');
    const alumnoRole = await obtenerRol('ALUMNO', 'Alumno');
    const maestroRole = await obtenerRol('MAESTRO', 'Maestro');
    const superadminRole = await obtenerRol('SUPERADMIN', 'Superadmin');

    const usuarios = dataSource.getRepository(Usuario);
    const password = 'Integracion_Segura_42!';
    const passwordHash = await bcrypt.hash(password, 4);
    const admin = await usuarios.save(usuarios.create({
      email: `admin_${sufijo}@example.invalid`, passwordHash, nombre: 'Admin', apellidoPaterno: 'Integración',
      apellidoMaterno: null, telefono: null, activo: true, roles: [administrativo, finanzas],
    }));
    adminId = admin.id;
    await dataSource.getRepository(UsuarioPlantel).save(
      dataSource.getRepository(UsuarioPlantel).create({ usuarioId: admin.id, plantelId, activo: true }),
    );

    const usuarioFinanzas = await usuarios.save(usuarios.create({
      email: `finanzas_${sufijo}@example.invalid`, passwordHash, nombre: 'Finanzas', apellidoPaterno: 'Integración',
      activo: true, roles: [finanzas],
    }));
    finanzasId = usuarioFinanzas.id;
    await dataSource.getRepository(UsuarioPlantel).save(
      dataSource.getRepository(UsuarioPlantel).create({ usuarioId: usuarioFinanzas.id, plantelId, activo: true }),
    );

    const superadmin = await usuarios.save(usuarios.create({
      email: `root_${sufijo}@example.invalid`, passwordHash, nombre: 'Superadmin', apellidoPaterno: 'Integración',
      apellidoMaterno: null, telefono: null, activo: true, roles: [superadminRole],
    }));
    superadminId = superadmin.id;

    const docenteUsuario = await usuarios.save(usuarios.create({
      email: `docente_${sufijo}@example.invalid`, passwordHash, nombre: 'Docente', apellidoPaterno: 'Fuera',
      apellidoMaterno: null, telefono: null, activo: true, roles: [maestroRole],
    }));
    const docenteFuera = await dataSource.getRepository(Docente).save(
      dataSource.getRepository(Docente).create({ usuarioId: docenteUsuario.id, numEmpleado: `D${sufijo}` }),
    );
    docenteFueraDeAlcanceId = docenteFuera.id;
    await dataSource.getRepository(UsuarioPlantel).save(
      dataSource.getRepository(UsuarioPlantel).create({
        usuarioId: docenteUsuario.id, plantelId: otroPlantelId, activo: true,
      }),
    );

    const alumnoUsuario = await usuarios.save(usuarios.create({
      email: `alumno_${sufijo}@example.invalid`, passwordHash, nombre: 'Alumno', apellidoPaterno: 'Integración',
      apellidoMaterno: null, telefono: null, activo: true, roles: [alumnoRole],
    }));
    alumnoUsuarioId = alumnoUsuario.id;
    const alumno = await dataSource.getRepository(Alumno).save(
      dataSource.getRepository(Alumno).create({
        usuarioId: alumnoUsuario.id, plantelId, matricula: `M${sufijo}`,
        curp: `CURP${sufijo}`, tutorNombre: 'Tutor Privado', tutorTelefono: '5550000000', direccion: 'Domicilio privado',
      }),
    );
    alumnoId = alumno.id;

    const concepto = await dataSource.getRepository(ConceptoPago).save(
      dataSource.getRepository(ConceptoPago).create({
        clave: `CW${sufijo}`, nombre: 'Cargo webhook de integración', tipo: 'COLEGIATURA', montoBase: 125,
      }),
    );
    const cargo = await dataSource.getRepository(Cargo).save(
      dataSource.getRepository(Cargo).create({
        alumnoId, plantelId, conceptoId: concepto.id, cicloId: null, periodo: null,
        descripcion: 'Cargo webhook de integración', monto: 125, descuento: 0, recargo: 0,
        fechaVencimiento: null, estatus: 'PENDIENTE',
      }),
    );
    cargoWebhookId = cargo.id;
    const orden = await dataSource.getRepository(OrdenPago).save(
      dataSource.getRepository(OrdenPago).create({
        alumnoId, plantelId, cargoId: cargo.id, monto: 125, descripcion: cargo.descripcion,
        proveedor: 'OPENPAY', idExterno: `ch_${sufijo}`, urlPago: null, estatus: 'PENDIENTE',
        expiraEn: null, payloadWebhook: null,
      }),
    );
    ordenId = orden.id;
  });

  const contexto: ContextoIntegracion = {
get app() { return app; }, set app(valor) { app = valor; },
get dataSource() { return dataSource; }, set dataSource(valor) { dataSource = valor; },
get baseUrl() { return baseUrl; }, set baseUrl(valor) { baseUrl = valor; },
get sufijo() { return sufijo; }, set sufijo(valor) { sufijo = valor; },
get plantelId() { return plantelId; }, set plantelId(valor) { plantelId = valor; },
get otroPlantelId() { return otroPlantelId; }, set otroPlantelId(valor) { otroPlantelId = valor; },
get adminId() { return adminId; }, set adminId(valor) { adminId = valor; },
get finanzasId() { return finanzasId; }, set finanzasId(valor) { finanzasId = valor; },
get superadminId() { return superadminId; }, set superadminId(valor) { superadminId = valor; },
get alumnoId() { return alumnoId; }, set alumnoId(valor) { alumnoId = valor; },
get alumnoUsuarioId() { return alumnoUsuarioId; }, set alumnoUsuarioId(valor) { alumnoUsuarioId = valor; },
get grupoMateriaIdMaestro() { return grupoMateriaIdMaestro; }, set grupoMateriaIdMaestro(valor) { grupoMateriaIdMaestro = valor; },
get docenteFueraDeAlcanceId() { return docenteFueraDeAlcanceId; }, set docenteFueraDeAlcanceId(valor) { docenteFueraDeAlcanceId = valor; },
get ordenId() { return ordenId; }, set ordenId(valor) { ordenId = valor; },
get cargoWebhookId() { return cargoWebhookId; }, set cargoWebhookId(valor) { cargoWebhookId = valor; },
get archivoPrueba() { return archivoPrueba; }, set archivoPrueba(valor) { archivoPrueba = valor; },
get api() { return api; },
get passwords() { return passwords; },
get emitirToken() { return emitirToken; },
get emitirFinanzasB() { return emitirFinanzasB; },
};
const casos = { ...casos_baseline, ...casos_identidad, ...casos_academico, ...casos_calificaciones, ...casos_finanzas, ...casos_archivos, ...casos_calendario, ...casos_conducta, ...casos_analitica, ...casos_importaciones, ...casos_roles };
Object.keys(casos).map(Number).sort((a,b) => a-b).forEach((id) => casos[id](contexto));

  afterAll(async () => {
    if (archivoPrueba) {
      const destino = resolve(process.cwd(), process.env.UPLOADS_DIR || 'uploads', basename(archivoPrueba));
      try { unlinkSync(destino); } catch { /* El archivo puede no haberse escrito o ya no existir. */ }
    }
    if (app) await app.close();
  });

  if (process.env.RUN_WEB_E2E === '1') for (const tipo of ['academico', 'financiero'] as const) {
    it(`navegador real: recorrido ${tipo} completo con API y DB reales`, async () => {
      const root = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: superadminId })).email);
      const usuario = await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId }); await emitirToken(usuario.email);
      const docente = await api('/docentes', { method: 'POST', token: root, body: { email: `browserdoc_${tipo}_${sufijo}@example.invalid`, password: 'Integracion_Segura_42!', nombre: 'Docente', apellidoPaterno: 'Navegador', numEmpleado: `BW${tipo[0]}${sufijo}`, plantelIds: [plantelId] } }); expect(docente.response.status).toBe(201);
      const clase = await dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: grupoMateriaIdMaestro });
      const concepto = await dataSource.getRepository(ConceptoPago).findOneByOrFail({ clave: `CW${sufijo}` });
      await (await import('./recorridos-web')).recorridoWeb({ baseUrl, email: usuario.email, password: passwords.get(usuario.email) ?? 'Integracion_Segura_42!', sufijo, plantelId, cicloId: clase.grupo.cicloId, materiaId: clase.materiaId, docenteId: docente.data.id, conceptoId: concepto.id }, tipo);
    });
  }
});
