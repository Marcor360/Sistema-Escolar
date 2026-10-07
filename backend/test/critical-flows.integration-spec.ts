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

  it('mantiene paridad de columnas nullable entre las entidades y el baseline migrado', async () => {
    const runner = dataSource.createQueryRunner();
    try {
      for (const metadata of dataSource.entityMetadatas) {
        const table = await runner.getTable(metadata.tablePath);
        expect(table).toBeDefined();
        expect(table!.columns.map((column) => column.name).sort())
          .toEqual(metadata.columns.map((column) => column.databaseName).sort());
        for (const column of metadata.columns) {
          const physical = table!.findColumnByName(column.databaseName)!;
          expect(`${metadata.tableName}.${column.databaseName}: ${physical.isNullable}`)
            .toBe(`${metadata.tableName}.${column.databaseName}: ${column.isNullable}`);
          if (column.length) expect(physical.length).toBe(column.length);
          if (column.type === 'decimal') {
            expect(physical.precision).toBe(column.precision);
            expect(physical.scale).toBe(column.scale);
          }
        }
      }
    } finally {
      await runner.release();
    }
  });

  it('conserva los grupos preexistentes al actualizar el índice histórico', async () => {
    const grupoExistente = await dataSource.getRepository(Grupo).findOneBy({ nombre: 'GRUPO_MIGRACION_EXISTENTE' });
    expect(grupoExistente).toEqual(expect.objectContaining({ nombre: 'GRUPO_MIGRACION_EXISTENTE' }));
  });

  afterAll(async () => {
    if (archivoPrueba) {
      const destino = resolve(process.cwd(), process.env.UPLOADS_DIR || 'uploads', basename(archivoPrueba));
      try { unlinkSync(destino); } catch { /* El archivo puede no haberse escrito o ya no existir. */ }
    }
    if (app) await app.close();
  });

  it('autentica y limita el detalle de planteles a las asignaciones del usuario', async () => {
    const password = 'Integracion_Segura_42!';
    const admin = await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId });
    const inicioSesion = await api('/auth/login', {
      method: 'POST', headers: { 'x-portal': 'WEB' }, body: { email: admin.email, password },
    });
    expect(inicioSesion.response.status).toBe(201);
    const token = inicioSesion.data.accessToken as string;

    const perfil = await api('/auth/me', { token });
    expect(perfil.response.status).toBe(200);
    expect(perfil.data.email).toBe(admin.email);

    const mios = await api('/planteles/mios', { token });
    expect(mios.response.status).toBe(200);
    expect(mios.data.map((p: Plantel) => p.id)).toContain(plantelId);
    expect(mios.data.map((p: Plantel) => p.id)).not.toContain(otroPlantelId);

    const fueraDeAlcance = await api(`/planteles/${otroPlantelId}`, { token });
    expect(fueraDeAlcance.response.status).toBe(403);
  });

  it('no serializa hashes en login, perfil, alumnos, docentes ni usuarios', async () => {
    const admin = await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId });
    const superadmin = await dataSource.getRepository(Usuario).findOneByOrFail({ id: superadminId });
    const tokenAdmin = await emitirToken(admin.email);
    const tokenRoot = await emitirToken(superadmin.email);
    const inicioSesion = await api('/auth/login', {
      method: 'POST', headers: { 'x-portal': 'WEB' },
      body: { email: admin.email, password: 'Integracion_Segura_42!' },
    });
    expect(inicioSesion.response.status).toBe(201);
    const nuevoDocente = await api('/docentes', {
      method: 'POST', token: tokenAdmin,
      body: {
        email: `docente_visible_${sufijo}@example.invalid`, password: 'Integracion_Segura_42!',
        nombre: 'Docente', apellidoPaterno: 'Visible', numEmpleado: `V${sufijo}`, plantelIds: [plantelId],
      },
    });
    expect(nuevoDocente.response.status).toBe(201);

    const respuestas = await Promise.all([
      api('/alumnos', { token: tokenAdmin }),
      api(`/alumnos/${alumnoId}`, { token: tokenAdmin }),
      api('/docentes', { token: tokenAdmin }),
      api(`/docentes/${nuevoDocente.data.id}`, { token: tokenAdmin }),
      api('/usuarios', { token: tokenRoot }),
      api(`/usuarios/${adminId}`, { token: tokenRoot }),
      api('/auth/me', { token: tokenAdmin }),
      api(`/finanzas/ordenes/${ordenId}`, { token: tokenAdmin }),
      api('/finanzas/pagos', { token: tokenAdmin }),
    ]);
    for (const respuesta of respuestas) expect(respuesta.response.status).toBe(200);
    for (const respuesta of respuestas) {
      expect(JSON.stringify(respuesta.data)).not.toContain('passwordHash');
    }
    expect(JSON.stringify(inicioSesion.data)).not.toContain('passwordHash');
    expect(JSON.stringify(nuevoDocente.data)).not.toContain('passwordHash');
  });

  it('rechaza consultar, editar o dar de baja docentes fuera del alcance del plantel', async () => {
    const admin = await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId });
    const token = await emitirToken(admin.email);

    const detalle = await api(`/docentes/${docenteFueraDeAlcanceId}`, { token });
    const edicion = await api(`/docentes/${docenteFueraDeAlcanceId}`, {
      method: 'PATCH', token, body: { especialidad: 'Cambio no autorizado' },
    });
    const baja = await api(`/docentes/${docenteFueraDeAlcanceId}`, { method: 'DELETE', token });

    expect(detalle.response.status).toBe(403);
    expect(edicion.response.status).toBe(403);
    expect(baja.response.status).toBe(403);
  });

  it('ADMINISTRATIVO y FINANZAS no acceden a alumnos de otro plantel', async () => {
    const admin = await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId });
    const token = await emitirToken(admin.email);
    const usuarioOtroPlantel = await dataSource.getRepository(Usuario).save(dataSource.getRepository(Usuario).create({
      email: `alumno_fuera_${sufijo}@example.invalid`, passwordHash: await bcrypt.hash('Integracion_Segura_42!', 4),
      nombre: 'Alumno', apellidoPaterno: 'Fuera', activo: true,
      roles: [await dataSource.getRepository(Rol).findOneByOrFail({ clave: 'ALUMNO' })],
    }));
    const alumnoFuera = await dataSource.getRepository(Alumno).save(dataSource.getRepository(Alumno).create({
      usuarioId: usuarioOtroPlantel.id, plantelId: otroPlantelId, matricula: `F${sufijo}`,
    }));

    const [listado, detalle, estadoCuenta, pagos] = await Promise.all([
      api('/alumnos', { token }),
      api(`/alumnos/${alumnoFuera.id}`, { token }),
      api(`/finanzas/alumnos/${alumnoFuera.id}/estado-cuenta`, { token }),
      api(`/finanzas/pagos?alumnoId=${alumnoFuera.id}`, { token }),
    ]);
    expect(listado.response.status).toBe(200);
    expect(listado.data.datos.map((a: Alumno) => a.id)).not.toContain(alumnoFuera.id);
    expect(detalle.response.status).toBe(403);
    expect(estadoCuenta.response.status).toBe(403);
    expect(pagos.response.status).toBe(200);
    expect(pagos.data.datos).toEqual([]);
  });

  it('FINANZAS recibe los datos mínimos del alumno para operar su cuenta', async () => {
    const finanzas = await dataSource.getRepository(Usuario).findOneByOrFail({ id: finanzasId });
    const token = await emitirToken(finanzas.email);
    const [perfil, estado] = await Promise.all([
      api(`/alumnos/${alumnoId}`, { token }),
      api(`/finanzas/alumnos/${alumnoId}/estado-cuenta`, { token }),
    ]);
    expect(perfil.response.status).toBe(200);
    expect(estado.response.status).toBe(200);
    for (const respuesta of [perfil, estado]) {
      expect(JSON.stringify(respuesta.data)).not.toContain(`CURP${sufijo}`);
      expect(JSON.stringify(respuesta.data)).not.toContain('Tutor Privado');
      expect(JSON.stringify(respuesta.data)).not.toContain('5550000000');
      expect(JSON.stringify(respuesta.data)).not.toContain('Domicilio privado');
    }
  });

  it('revierte la cuenta si falla el alta del expediente relacionado', async () => {
    const superadmin = await dataSource.getRepository(Usuario).findOneByOrFail({ id: superadminId });
    const token = await emitirToken(superadmin.email);
    const email = `rollback_${sufijo}@example.invalid`;
    const resultado = await api('/alumnos', {
      method: 'POST', token,
      body: {
        email, password: 'Integracion_Segura_42!', nombre: 'Rollback', apellidoPaterno: 'Prueba',
        matricula: `R${sufijo}`, plantelId: 2147483000,
      },
    });

    expect(resultado.response.status).toBeGreaterThanOrEqual(400);
    expect(await dataSource.getRepository(Usuario).findOneBy({ email })).toBeNull();
  });

  it('expone disponibilidad con verificación real de la base', async () => {
    const health = await api('/health');
    expect(health.response.status).toBe(200);
    expect(health.data).toEqual({ status: 'ok', database: 'ok' });
    expect((await api('/health/live')).response.status).toBe(200);
    const ready = await api('/health/ready');
    expect(ready.response.status).toBe(200);
    expect(ready.data.schema).toBe('ok');
  });

  it('prepara sin cambiar el vigente y activa un único ciclo mediante transición explícita', async () => {
    const token = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: superadminId })).email);
    const previos = await dataSource.getRepository(CicloEscolar).findBy({ activo: true });
    const crear = (clave: string) => api('/academico/ciclos', { method: 'POST', token, body: { clave, nombre: 'Ciclo preparado', fechaInicio: '2026-08-01', fechaFin: '2027-07-31' } });
    const primero = await crear(`A${sufijo}`); const segundo = await crear(`B${sufijo}`);
    expect(primero.response.status).toBe(201); expect(segundo.response.status).toBe(201);
    expect(primero.data).toMatchObject({ activo: false, estado: 'PREPARACION' });
    expect((await dataSource.getRepository(CicloEscolar).findBy({ activo: true })).map((c) => c.id)).toEqual(previos.map((c) => c.id));
    expect((await api(`/academico/ciclos/${primero.data.id}`, { method: 'PATCH', token, body: { activo: true } })).response.status).toBe(400);
    for (const c of previos) {
      expect((await api(`/academico/ciclos/${c.id}/iniciar-cierre`, { method: 'POST', token, body: { confirmado: true } })).response.status).toBe(201);
      expect((await api(`/academico/ciclos/${c.id}/cerrar`, { method: 'POST', token, body: { confirmado: true } })).response.status).toBe(201);
    }
    const respuestas = await Promise.all([primero, segundo].map((c) => api(`/academico/ciclos/${c.data.id}/activar`, { method: 'POST', token, body: { confirmado: true } })));
    expect(respuestas.filter((c) => c.response.status === 201)).toHaveLength(1);
    expect(respuestas.filter((c) => c.response.status === 409)).toHaveLength(1);
    expect(await dataSource.getRepository(CicloEscolar).countBy({ activo: true })).toBe(1);
    const vigente = await dataSource.getRepository(CicloEscolar).findOneByOrFail({ activo: true });
    expect((await api(`/academico/ciclos/${vigente.id}/iniciar-cierre`, { method: 'POST', token, body: { confirmado: true } })).response.status).toBe(201);
    expect((await api(`/academico/ciclos/${vigente.id}/cerrar`, { method: 'POST', token, body: { confirmado: true } })).response.status).toBe(201);
  });

  it('inscribe a un alumno, captura una calificaci??n y la muestra en su portal', async () => {
    const admin = await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId });
    const alumnoUsuario = await dataSource.getRepository(Usuario).findOneByOrFail({ id: alumnoUsuarioId });
    const tokenAdmin = await emitirToken(admin.email);
    const tokenAlumno = await emitirToken(alumnoUsuario.email);
    expect((await api('/academico/materias', { token: tokenAlumno })).response.status).toBe(403);
    expect((await api('/academico/ciclos', { token: tokenAlumno })).response.status).toBe(403);

    const ciclo = await api('/academico/ciclos', {
      method: 'POST', token: tokenAdmin,
      body: { clave: `C${sufijo}`, nombre: 'Ciclo de integración', fechaInicio: '2026-08-01', fechaFin: '2027-07-31' },
    });
    expect(ciclo.response.status).toBe(201);
    const tokenActivacion = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: superadminId })).email);
    expect((await api(`/academico/ciclos/${ciclo.data.id}/activar`, { method: 'POST', token: tokenActivacion, body: { confirmado: true } })).response.status).toBe(201);
    const materia = await api('/academico/materias', {
      method: 'POST', token: tokenAdmin,
      body: { clave: `MAT${sufijo}`, nombre: 'Materia de integración' },
    });
    expect(materia.response.status).toBe(201);
    const grupo = await api('/academico/grupos', {
      method: 'POST', token: tokenAdmin,
      body: { cicloId: ciclo.data.id, plantelId, nombre: `G${sufijo}`, grado: '1' },
    });
    expect(grupo.response.status).toBe(201);
    const tokenSuperadmin = await emitirToken(
      (await dataSource.getRepository(Usuario).findOneByOrFail({ id: superadminId })).email,
    );
    const grupoMismoNombreOtroPlantel = await api('/academico/grupos', {
      method: 'POST', token: tokenSuperadmin,
      body: { cicloId: ciclo.data.id, plantelId: otroPlantelId, nombre: `G${sufijo}`, grado: '1' },
    });
    expect(grupoMismoNombreOtroPlantel.response.status).toBe(201);
    const grupoDuplicadoMismoPlantel = await api('/academico/grupos', {
      method: 'POST', token: tokenSuperadmin,
      body: { cicloId: ciclo.data.id, plantelId, nombre: `G${sufijo}`, grado: '2' },
    });
    expect(grupoDuplicadoMismoPlantel.response.status).toBe(409);
    const grupoId = grupo.data.id;
    const asignacion = await api(`/academico/grupos/${grupoId}/materias`, {
      method: 'POST', token: tokenAdmin, body: { materiaId: materia.data.id },
    });
    expect(asignacion.response.status).toBe(201);
    const grupoMateriaId = asignacion.data.id;
    grupoMateriaIdMaestro = grupoMateriaId;

    const inscripcion = await api(`/academico/grupos/${grupoId}/alumnos`, {
      method: 'POST', token: tokenAdmin, body: { alumnoId },
    });
    expect(inscripcion.response.status).toBe(201);
    const captura = await api('/calificaciones/captura', {
      method: 'POST', token: tokenAdmin,
      body: { grupoMateriaId, parcial: 1, items: [{ alumnoId, calificacion: 92 }] },
    });
    expect(captura.response.status).toBe(201);
    expect(captura.data.capturadas).toBe(1);

    const calificaciones = await api('/calificaciones/mias', { token: tokenAlumno });
    expect(calificaciones.response.status).toBe(200);
    expect(calificaciones.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ grupoMateriaId, parcial: 1, calificacion: 92 }),
    ]));
    expect(await dataSource.getRepository(Inscripcion).countBy({ alumnoId, grupoId, estatus: 'ACTIVA' })).toBe(1);
  });

  it('impide inscribir en grupos inactivos y a alumnos dados de baja', async () => {
    const admin = await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId });
    const token = await emitirToken(admin.email);
    const ciclo = await dataSource.getRepository(CicloEscolar).findOneByOrFail({ clave: `C${sufijo}` });
    const inactivo = await api('/academico/grupos', {
      method: 'POST', token,
      body: { cicloId: ciclo.id, plantelId, nombre: `INACTIVO${sufijo}` },
    });
    expect(inactivo.response.status).toBe(201);
    expect((await api(`/academico/grupos/${inactivo.data.id}`, { method: 'DELETE', token })).response.status).toBe(200);
    const inscripcionInactiva = await api(`/academico/grupos/${inactivo.data.id}/alumnos`, {
      method: 'POST', token, body: { alumnoId },
    });
    expect(inscripcionInactiva.response.status).toBe(409);
    expect(await dataSource.getRepository(Inscripcion).countBy({ grupoId: inactivo.data.id })).toBe(0);

    const alumnoBaja = await api('/alumnos', {
      method: 'POST', token,
      body: {
        email: `alumno_baja_${sufijo}@example.invalid`, password: 'Integracion_Segura_42!',
        nombre: 'Alumno', apellidoPaterno: 'Baja', matricula: `AB${sufijo}`, plantelId,
      },
    });
    expect(alumnoBaja.response.status).toBe(201);
    await dataSource.getRepository(Alumno).update(alumnoBaja.data.id, { estatus: 'BAJA' });
    const grupoActivo = await dataSource.getRepository(Grupo).findOneByOrFail({ nombre: `G${sufijo}`, plantelId });
    const inscripcionBaja = await api(`/academico/grupos/${grupoActivo.id}/alumnos`, {
      method: 'POST', token, body: { alumnoId: alumnoBaja.data.id },
    });
    expect(inscripcionBaja.response.status).toBe(409);
    expect(await dataSource.getRepository(Inscripcion).countBy({ grupoId: grupoActivo.id, alumnoId: alumnoBaja.data.id })).toBe(0);
  });

  it('conserva notas de entregas calificadas y bloquea envíos a actividades desactivadas', async () => {
    const admin = await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId });
    const alumnoUsuario = await dataSource.getRepository(Usuario).findOneByOrFail({ id: alumnoUsuarioId });
    const tokenAdmin = await emitirToken(admin.email);
    const tokenAlumno = await emitirToken(alumnoUsuario.email);
    const actividad = await api('/actividades', {
      method: 'POST', token: tokenAdmin,
      body: { grupoMateriaId: grupoMateriaIdMaestro, titulo: `Reentrega ${sufijo}` },
    });
    expect(actividad.response.status).toBe(201);

    const primera = await api(`/actividades/${actividad.data.id}/entrega`, {
      method: 'POST', token: tokenAlumno, body: { comentario: 'Primera versión' },
    });
    expect(primera.response.status).toBe(201);
    const calificada = await api(`/entregas/${primera.data.id}/calificar`, {
      method: 'PATCH', token: tokenAdmin, body: { calificacion: 80, comentario: 'Corregir' },
    });
    expect(calificada.response.status).toBe(200);
    const corregida = await api(`/actividades/${actividad.data.id}/entrega`, {
      method: 'POST', token: tokenAlumno, body: { comentario: 'Segunda versión' },
    });
    expect(corregida.response.status).toBe(409);
    const entregaConservada = await dataSource.getRepository(Entrega).findOneByOrFail({ id: primera.data.id });
    expect(entregaConservada.calificacion).toBe(80);
    expect(entregaConservada.estatus).toBe('CALIFICADA');

    expect((await api(`/actividades/${actividad.data.id}`, { method: 'DELETE', token: tokenAdmin })).response.status).toBe(200);
    const inactiva = await api(`/actividades/${actividad.data.id}/entrega`, {
      method: 'POST', token: tokenAlumno, body: { comentario: 'Tercera versión' },
    });
    expect(inactiva.response.status).toBe(409);
  });

  it('MAESTRO solo lista y consulta alumnos de sus grupos, aunque compartan plantel', async () => {
    const admin = await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId });
    const tokenAdmin = await emitirToken(admin.email);
    const altaDocente = await api('/docentes', {
      method: 'POST', token: tokenAdmin,
      body: {
        email: `maestro_scope_${sufijo}@example.invalid`, password: 'Integracion_Segura_42!',
        nombre: 'Maestro', apellidoPaterno: 'Scope', numEmpleado: `S${sufijo}`, plantelIds: [plantelId],
      },
    });
    expect(altaDocente.response.status).toBe(201);
    const asignacion = await api(`/academico/grupo-materias/${grupoMateriaIdMaestro}/docente/${altaDocente.data.id}`, {
      method: 'PATCH', token: tokenAdmin,
    });
    expect(asignacion.response.status).toBe(200);
    const segundoAlumno = await api('/alumnos', {
      method: 'POST', token: tokenAdmin,
      body: {
        email: `alumno_otro_grupo_${sufijo}@example.invalid`, password: 'Integracion_Segura_42!',
        nombre: 'Alumno', apellidoPaterno: 'Otro grupo', matricula: `O${sufijo}`, plantelId,
      },
    });
    expect(segundoAlumno.response.status).toBe(201);
    const ciclo = await dataSource.getRepository(CicloEscolar).findOneByOrFail({ clave: `C${sufijo}` });
    const grupoOtro = await api('/academico/grupos', {
      method: 'POST', token: tokenAdmin,
      body: { cicloId: ciclo.id, plantelId, nombre: `Y${sufijo}`, grado: '2' },
    });
    expect(grupoOtro.response.status).toBe(201);
    const inscripcion = await api(`/academico/grupos/${grupoOtro.data.id}/alumnos`, {
      method: 'POST', token: tokenAdmin, body: { alumnoId: segundoAlumno.data.id },
    });
    expect(inscripcion.response.status).toBe(201);

    const tokenMaestro = await emitirToken(`maestro_scope_${sufijo}@example.invalid`);
    const [listado, propio, ajeno] = await Promise.all([
      api('/alumnos', { token: tokenMaestro }),
      api(`/alumnos/${alumnoId}`, { token: tokenMaestro }),
      api(`/alumnos/${segundoAlumno.data.id}`, { token: tokenMaestro }),
    ]);
    expect(listado.response.status).toBe(200);
    expect(listado.data.datos.map((a: Alumno) => a.id)).toContain(alumnoId);
    expect(listado.data.datos.map((a: Alumno) => a.id)).not.toContain(segundoAlumno.data.id);
    expect(propio.response.status).toBe(200);
    expect(ajeno.response.status).toBe(403);
  });

  it('genera una sola colegiatura si dos solicitudes llegan simultaneamente', async () => {
    const admin = await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId });
    const token = await emitirToken(admin.email);
    const ciclo = await dataSource.getRepository(CicloEscolar).findOneByOrFail({ clave: `C${sufijo}` });
    const conceptos = dataSource.getRepository(ConceptoPago);
    const concepto = await conceptos.save(conceptos.create({
      clave: 'COL', nombre: 'Colegiatura integracion', tipo: 'COLEGIATURA', montoBase: 100,
    }));
    const body = { cicloId: ciclo.id, periodo: '2026-09', monto: 100, plantelId, confirmado: true };
    const [primera, segunda] = await Promise.all([
      api('/finanzas/cargos/generar-colegiaturas', { method: 'POST', token, body }),
      api('/finanzas/cargos/generar-colegiaturas', { method: 'POST', token, body }),
    ]);

    expect(primera.response.status).toBe(201);
    expect(segunda.response.status).toBe(201);
    expect(primera.data.generados + segunda.data.generados).toBe(2);
    expect(await dataSource.getRepository(Cargo).countBy({
      conceptoId: concepto.id,
      cicloId: ciclo.id,
      periodo: '2026-09',
    })).toBe(2);
    expect(await dataSource.getRepository(Cargo).countBy({
      claveGeneracion: `COLEGIATURA:${ciclo.id}:${alumnoId}:2026-09`,
    })).toBe(1);
  });

  it('evita pago manual sobre una orden pendiente y deduplica webhooks concurrentes', async () => {
    const orden = await dataSource.getRepository(OrdenPago).findOneByOrFail({ id: ordenId });
    const admin = await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId });
    const token = await emitirToken(admin.email);
    const pagoManual = await api('/finanzas/pagos', {
      method: 'POST', token,
      body: {
        alumnoId, cargoId: cargoWebhookId, monto: 125, metodo: 'EFECTIVO',
        referencia: `MAN${sufijo}`, claveIdempotencia: randomUUID(),
      },
    });
    expect(pagoManual.response.status).toBe(409);

    const evento = { type: 'charge.succeeded', transaction: {
      id: orden.idExterno, order_id: `ORD-${orden.id}`, amount: 125,
      currency: 'MXN', transaction_type: 'charge', status: 'completed',
    } };
    const [primera, segunda] = await Promise.all([
      api('/finanzas/webhook/openpay', { method: 'POST', body: evento }),
      api('/finanzas/webhook/openpay', { method: 'POST', body: evento }),
    ]);

    expect(primera.response.status).toBe(200);
    expect(segunda.response.status).toBe(200);
    expect(await dataSource.getRepository(Pago).countBy({ ordenPagoId: ordenId })).toBe(1);
    expect(await dataSource.getRepository(Notificacion).countBy({ usuarioId: alumnoUsuarioId })).toBe(1);
    expect((await dataSource.getRepository(OrdenPago).findOneByOrFail({ id: ordenId })).estatus).toBe('COMPLETADA');
    expect((await dataSource.getRepository(Cargo).findOneByOrFail({ id: cargoWebhookId })).estatus).toBe('PAGADO');
  });

  it('acepta pagos parciales y rechaza exceder el saldo restante', async () => {
    const admin = await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId });
    const token = await emitirToken(admin.email);
    const concepto = await api('/finanzas/conceptos', {
      method: 'POST', token,
      body: { clave: `FM${sufijo}`, nombre: 'Cargo manual integración', tipo: 'COLEGIATURA', montoBase: 200 },
    });
    expect(concepto.response.status).toBe(201);
    const cargo = await api('/finanzas/cargos', {
      method: 'POST', token,
      body: {
        alumnoId, conceptoId: concepto.data.id, descripcion: 'Cargo manual', monto: 200,
        descuento: 0, fechaVencimiento: '2027-06-01',
      },
    });
    expect(cargo.response.status).toBe(201);

    const claveParcial = randomUUID();
    const parcial = await api('/finanzas/pagos', {
      method: 'POST', token,
      body: {
        alumnoId, cargoId: cargo.data.id, monto: 50, metodo: 'TRANSFERENCIA',
        referencia: `INT${sufijo}`, claveIdempotencia: claveParcial,
      },
    });
    expect(parcial.response.status).toBe(201);
    const reintento = await api('/finanzas/pagos', {
      method: 'POST', token,
      body: {
        alumnoId, cargoId: cargo.data.id, monto: 50, metodo: 'TRANSFERENCIA',
        referencia: `INT${sufijo}`, claveIdempotencia: claveParcial,
      },
    });
    expect(reintento.response.status).toBe(201);
    expect(reintento.data.id).toBe(parcial.data.id);
    const claveReutilizada = await api('/finanzas/pagos', {
      method: 'POST', token,
      body: {
        alumnoId, cargoId: cargo.data.id, monto: 60, metodo: 'TRANSFERENCIA',
        referencia: `INT${sufijo}`, claveIdempotencia: claveParcial,
      },
    });
    expect(claveReutilizada.response.status).toBe(409);
    const excedente = await api('/finanzas/pagos', {
      method: 'POST', token,
      body: {
        alumnoId, cargoId: cargo.data.id, monto: 150.01, metodo: 'EFECTIVO',
        referencia: `EXC${sufijo}`, claveIdempotencia: randomUUID(),
      },
    });
    expect(excedente.response.status).toBe(400);
    expect((await dataSource.getRepository(Cargo).findOneByOrFail({ id: cargo.data.id })).estatus).toBe('PARCIAL');
    expect(await dataSource.getRepository(Pago).countBy({ cargoId: cargo.data.id })).toBe(1);
  });

  it('revierte cargos y recargos cuando falla su bitácora financiera', async () => {
    const admin = await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId });
    const token = await emitirToken(admin.email);
    const concepto = await dataSource.getRepository(ConceptoPago).save(
      dataSource.getRepository(ConceptoPago).create({
        aplicaRecargo: true, clave: `TX${sufijo}`, nombre: 'Concepto transaccional', tipo: 'OTRO', montoBase: 100,
      }),
    );
    const bitacora = app.get(BitacoraFinancieraService);
    const descripcion = `Cargo reversible ${sufijo}`;
    const fallo = jest.spyOn(bitacora, 'registrar').mockRejectedValueOnce(new Error('Bitácora no disponible'));
    try {
      const respuesta = await api('/finanzas/cargos', {
        method: 'POST', token,
        body: { alumnoId, conceptoId: concepto.id, descripcion, monto: 100, descuento: 0 },
      });
      expect(respuesta.response.status).toBe(500);
      expect(await dataSource.getRepository(Cargo).countBy({ descripcion })).toBe(0);
    } finally {
      fallo.mockRestore();
    }

    const creado = await api('/finanzas/cargos', {
      method: 'POST', token,
      body: {
        alumnoId, conceptoId: concepto.id, descripcion, monto: 100,
        descuento: 0, fechaVencimiento: '2020-01-01',
      },
    });
    expect(creado.response.status).toBe(201);
    const falloRecargo = jest.spyOn(bitacora, 'registrar').mockRejectedValueOnce(new Error('Bitácora no disponible'));
    try {
      const respuesta = await api('/finanzas/cargos/aplicar-recargos', {
        method: 'POST', token, body: { plantelId, porcentaje: 10, confirmado: true },
      });
      expect(respuesta.response.status).toBe(500);
      const cargo = await dataSource.getRepository(Cargo).findOneByOrFail({ id: creado.data.id });
      expect(cargo.recargo).toBe(0);
      expect(cargo.estatus).toBe('PENDIENTE');
    } finally {
      falloRecargo.mockRestore();
    }
  });

  it('entrega materiales solo a un alumno inscrito y sirve el enlace firmado', async () => {
    const admin = await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId });
    const alumnoUsuario = await dataSource.getRepository(Usuario).findOneByOrFail({ id: alumnoUsuarioId });
    const tokenAdmin = await emitirToken(admin.email);
    const tokenAlumno = await emitirToken(alumnoUsuario.email);
    const grupo = await dataSource.getRepository(Grupo).findOneByOrFail({ nombre: `G${sufijo}` });
    const asignacion = await dataSource.getRepository(GrupoMateria).findOneByOrFail({ grupoId: grupo.id });
    const formulario = new FormData();
    formulario.append('titulo', 'Guía integración');
    formulario.append('archivo', new Blob(['archivo de prueba']), `guia_${sufijo}.txt`);
    const carga = await api(`/grupo-materias/${asignacion.id}/materiales`, {
      method: 'POST', token: tokenAdmin, body: formulario,
    });
    expect(carga.response.status).toBe(201);
    archivoPrueba = carga.data.archivoRuta;

    const listado = await api(`/grupo-materias/${asignacion.id}/materiales`, { token: tokenAlumno });
    expect(listado.response.status).toBe(200);
    const enlace = await api(`/archivos/materiales/${carga.data.id}/enlace`, { token: tokenAlumno });
    expect(enlace.response.status).toBe(200);
    const descarga = await fetch(new URL(enlace.data.url, baseUrl));
    expect(descarga.status).toBe(200);
    expect(await descarga.text()).toBe('archivo de prueba');
    expect((await api(`/materiales/${carga.data.id}`, { method: 'PATCH', token: tokenAdmin, body: { titulo: 'Guía corregida' } })).response.status).toBe(200);
    const antes = readdirSync(process.env.UPLOADS_DIR!);
    const invalido = new FormData(); invalido.append('titulo', 'x'.repeat(151)); invalido.append('archivo', new Blob(['archivo de prueba']), 'invalido.txt');
    expect((await api(`/grupo-materias/${asignacion.id}/materiales`, { method: 'POST', token: tokenAdmin, body: invalido })).response.status).toBe(400);
    expect(readdirSync(process.env.UPLOADS_DIR!)).toEqual(antes);
    expect((await api(`/materiales/${carga.data.id}`, { method: 'DELETE', token: tokenAlumno })).response.status).toBe(403);
    expect((await api(`/materiales/${carga.data.id}`, { method: 'DELETE', token: tokenAdmin })).response.status).toBe(200);
    expect(await dataSource.getRepository(Material).findOneBy({ id: carga.data.id })).toBeNull();
    expect(existsSync(resolve(process.env.UPLOADS_DIR!, basename(carga.data.archivoRuta)))).toBe(false);
    archivoPrueba = undefined;
  });

  it('revoca JWT anteriores tras bajas de alumno/docente y cambio de contraseña', async () => {
    const admin = await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId });
    const tokenAdmin = await emitirToken(admin.email);
    const altaAlumno = await api('/alumnos', {
      method: 'POST', token: tokenAdmin,
      body: {
        email: `baja_alumno_${sufijo}@example.invalid`, password: 'Integracion_Segura_42!',
        nombre: 'Baja', apellidoPaterno: 'Alumno', matricula: `B${sufijo}`, plantelId,
      },
    });
    const tokenAlumno = await emitirToken(`baja_alumno_${sufijo}@example.invalid`);
    const bajaAlumno = await api(`/alumnos/${altaAlumno.data.id}`, { method: 'DELETE', token: tokenAdmin });
    expect(bajaAlumno.response.status).toBe(200);
    expect((await api('/auth/me', { token: tokenAlumno })).response.status).toBe(401);

    const altaDocente = await api('/docentes', {
      method: 'POST', token: tokenAdmin,
      body: {
        email: `baja_docente_${sufijo}@example.invalid`, password: 'Integracion_Segura_42!',
        nombre: 'Baja', apellidoPaterno: 'Docente', numEmpleado: `BD${sufijo}`, plantelIds: [plantelId],
      },
    });
    const tokenDocente = await emitirToken(`baja_docente_${sufijo}@example.invalid`);
    const bajaDocente = await api(`/docentes/${altaDocente.data.id}`, { method: 'DELETE', token: tokenAdmin });
    expect(bajaDocente.response.status).toBe(200);
    expect((await api('/auth/me', { token: tokenDocente })).response.status).toBe(401);

    const rolesRepo = dataSource.getRepository(Rol);
    const usuarioTemporal = await dataSource.getRepository(Usuario).save(dataSource.getRepository(Usuario).create({
      email: `revocable_${sufijo}@example.invalid`, passwordHash: await bcrypt.hash('Integracion_Segura_42!', 4),
      nombre: 'Revocable', apellidoPaterno: 'Sesión', activo: true,
      roles: [await rolesRepo.findOneByOrFail({ clave: 'ADMINISTRATIVO' })],
    }));
    await dataSource.getRepository(UsuarioPlantel).save(dataSource.getRepository(UsuarioPlantel).create({
      usuarioId: usuarioTemporal.id, plantelId, activo: true,
    }));
    const tokenAnterior = await emitirToken(usuarioTemporal.email);
    const cambio = await api('/auth/cambiar-password', {
      method: 'POST', token: tokenAnterior,
      body: { actual: 'Integracion_Segura_42!', nueva: 'Integracion_Nueva_42!' },
    });
    expect(cambio.response.status).toBe(201);
    expect((await api('/auth/me', { token: tokenAnterior })).response.status).toBe(401);
  });

  it('revoca el JWT al cerrar sesión y permite un nuevo inicio', async () => {
    const admin = await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId });
    const token = await emitirToken(admin.email);
    expect((await api('/auth/me', { token })).response.status).toBe(200);

    const cierre = await api('/auth/logout', { method: 'POST', token });
    expect(cierre.response.status).toBe(201);
    expect((await api('/auth/me', { token })).response.status).toBe(401);
    expect((await api('/auth/logout', { method: 'POST', token })).response.status).toBe(401);

    const nuevo = await emitirToken(admin.email);
    expect((await api('/auth/me', { token: nuevo })).response.status).toBe(200);
  });
  it('aísla eventos de dos grupos y planteles para alumnos, maestros y administrativo', async () => {
    const ciclo = await dataSource.getRepository(CicloEscolar).findOneByOrFail({ clave: `C${sufijo}` });
    const grupoA = await dataSource.getRepository(Grupo).findOneByOrFail({ nombre: `G${sufijo}`, plantelId });
    const grupoB = await dataSource.getRepository(Grupo).findOneByOrFail({ nombre: `Y${sufijo}`, plantelId });
    const tokenAdmin = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId })).email);
    const tokenSuper = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: superadminId })).email);
    const tokenAlumnoA = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: alumnoUsuarioId })).email);
    const tokenAlumnoB = await emitirToken(`alumno_otro_grupo_${sufijo}@example.invalid`);
    const tokenMaestroA = await emitirToken(`maestro_scope_${sufijo}@example.invalid`);
    const altaB = await api('/docentes', { method: 'POST', token: tokenAdmin, body: {
      email: `maestro_b_${sufijo}@example.invalid`, password: 'Integracion_Segura_42!',
      nombre: 'Maestro', apellidoPaterno: 'B', numEmpleado: `B${sufijo}`, plantelIds: [plantelId],
    } });
    expect(altaB.response.status).toBe(201);
    const materia = await dataSource.getRepository(Materia).findOneByOrFail({ clave: `MAT${sufijo}` });
    expect((await api(`/academico/grupos/${grupoB.id}/materias`, { method: 'POST', token: tokenAdmin,
      body: { materiaId: materia.id, docenteId: altaB.data.id } })).response.status).toBe(201);
    const tokenMaestroB = await emitirToken(`maestro_b_${sufijo}@example.invalid`);
    const grupoC = await dataSource.getRepository(Grupo).findOneByOrFail({ cicloId: ciclo.id, plantelId: otroPlantelId });
    const eventos = [
      { titulo: `GLOBAL-${sufijo}` }, { titulo: `PLANTEL-${sufijo}`, plantelId },
      { titulo: `A-${sufijo}`, grupoId: grupoA.id, plantelId },
      { titulo: `B-${sufijo}`, grupoId: grupoB.id, plantelId },
      { titulo: `C-${sufijo}`, grupoId: grupoC.id, plantelId: otroPlantelId },
    ];
    for (const evento of eventos) expect((await api('/calendario', { method: 'POST', token: tokenSuper,
      body: { ...evento, fechaInicio: '2026-10-07T12:00:00Z' } })).response.status).toBe(201);
    for (const [token, propios, ajenos] of [
      [tokenAlumnoA, ['GLOBAL', 'PLANTEL', 'A'], ['B', 'C']],
      [tokenAlumnoB, ['GLOBAL', 'PLANTEL', 'B'], ['A', 'C']],
      [tokenMaestroA, ['GLOBAL', 'PLANTEL', 'A'], ['B', 'C']],
      [tokenMaestroB, ['GLOBAL', 'PLANTEL', 'B'], ['A', 'C']],
      [tokenAdmin, ['GLOBAL', 'PLANTEL', 'A', 'B'], ['C']],
    ] as const) {
      const respuesta = await api('/calendario?desde=2026-10-01&hasta=2026-10-31', { token }); expect(respuesta.response.status).toBe(200);
      const titulos = respuesta.data.map((e: { titulo: string }) => e.titulo);
      for (const titulo of propios) expect(titulos).toContain(`${titulo}-${sufijo}`);
      for (const titulo of ajenos) expect(titulos).not.toContain(`${titulo}-${sufijo}`);
    }
    expect((await api('/calendario', { method: 'POST', token: tokenSuper,
      body: { titulo: 'Fechas invertidas', fechaInicio: '2026-10-08T12:00:00Z', fechaFin: '2026-10-07T12:00:00Z' } })).response.status).toBe(400);
    expect((await api(`/reportes/boleta/${alumnoId}`, { token: tokenMaestroA })).response.status).toBe(403);
  });

  it('bloquea PATCH de estado/plantel, conserva bajas/egresos y completa transferencias', async () => {
    const token = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: superadminId })).email);
    const grupo = await dataSource.getRepository(Grupo).findOneByOrFail({ nombre: `G${sufijo}`, plantelId });
    for (const accion of ['baja', 'egreso', 'transferencia']) {
      const alta = await api('/alumnos', { method: 'POST', token, body: {
        nombre: 'Transición', apellidoPaterno: accion, matricula: `T${accion.slice(0, 2)}${sufijo}`,
        email: `${accion}_${sufijo}@example.invalid`, password: 'Integracion_Segura_42!', plantelId,
      } }); expect(alta.response.status).toBe(201);
      const id = alta.data.id; const usuarioId = alta.data.usuarioId;
      const movil = await emitirToken(`${accion}_${sufijo}@example.invalid`);
      expect((await api(`/academico/grupos/${grupo.id}/alumnos`, { method: 'POST', token, body: { alumnoId: id } })).response.status).toBe(201);
      expect((await api(`/alumnos/${id}`, { method: 'PATCH', token, body: { estatus: 'BAJA' } })).response.status).toBe(400);
      expect((await api(`/alumnos/${id}`, { method: 'PATCH', token, body: { plantelId: otroPlantelId } })).response.status).toBe(400);
      const resultado = await api(`/alumnos/${id}/${accion}`, { method: 'POST', token,
        ...(accion === 'transferencia' ? { body: { plantelId: otroPlantelId } } : {}) });
      expect(resultado.response.status).toBe(201);
      expect(await dataSource.getRepository(Inscripcion).countBy({ alumnoId: id, estatus: 'ACTIVA' })).toBe(0);
      const expediente = await dataSource.getRepository(Alumno).findOneByOrFail({ id });
      const cuenta = await dataSource.getRepository(Usuario).findOneByOrFail({ id: usuarioId });
      if (accion === 'transferencia') { expect(expediente.plantelId).toBe(otroPlantelId); expect(cuenta.activo).toBe(true); }
      else {
        if (accion === 'egreso') {
          expect((await api(`/alumnos/${id}/baja`, { method: 'POST', token })).response.status).toBe(409);
          expect((await api(`/alumnos/${id}/reactivacion`, { method: 'POST', token, body: { motivo: 'Intento inválido' } })).response.status).toBe(409);
        }
        expect(expediente.estatus).toBe(accion === 'baja' ? 'BAJA' : 'EGRESADO'); expect(cuenta.activo).toBe(false);
        expect((await api('/auth/me', { token: movil })).response.status).toBe(401);
      }
    }
  });

  it('impide doble inscripción concurrente y cambios de ciclo; rechaza grupos en ciclos cerrados', async () => {
    const token = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId })).email);
    const grupoA = await dataSource.getRepository(Grupo).findOneByOrFail({ nombre: `G${sufijo}`, plantelId });
    const grupoB = await dataSource.getRepository(Grupo).findOneByOrFail({ nombre: `Y${sufijo}`, plantelId });
    const alta = await api('/alumnos', { method: 'POST', token, body: { nombre: 'Concurrente', apellidoPaterno: 'Prueba',
      matricula: `CON${sufijo}`, email: `con_${sufijo}@example.invalid`, password: 'Integracion_Segura_42!', plantelId } });
    expect(alta.response.status).toBe(201);
    const respuestas = await Promise.all([grupoA, grupoB].map((g) => api(`/academico/grupos/${g.id}/alumnos`, {
      method: 'POST', token, body: { alumnoId: alta.data.id },
    })));
    expect(respuestas.map((r) => r.response.status).sort()).toEqual([201, 409]);
    expect(await dataSource.getRepository(Inscripcion).countBy({ alumnoId: alta.data.id, estatus: 'ACTIVA' })).toBe(1);
    const cerrado = await dataSource.getRepository(CicloEscolar).findOneOrFail({ where: { estado: 'CERRADO' } });
    expect((await api('/academico/grupos', { method: 'POST', token, body: { cicloId: cerrado.id, plantelId, nombre: 'Cerrado' } })).response.status).toBe(409);
    expect((await api(`/academico/grupos/${grupoA.id}`, { method: 'PATCH', token, body: { cicloId: cerrado.id } })).response.status).toBe(409);
  });

  it('exige motivo, muestra faltantes y bloquea cierre/modificación del periodo', async () => {
    const token = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId })).email);
    const contexto = await dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: grupoMateriaIdMaestro });
    const faltante = await api('/alumnos', { method: 'POST', token, body: { nombre: 'Sin nota', apellidoPaterno: 'Periodo',
      matricula: `FAL${sufijo}`, email: `faltante_${sufijo}@example.invalid`, password: 'Integracion_Segura_42!', plantelId } });
    expect(faltante.response.status).toBe(201);
    expect((await api(`/academico/grupos/${contexto.grupoId}/alumnos`, { method: 'POST', token, body: { alumnoId: faltante.data.id } })).response.status).toBe(201);
    const ruta = `/calificaciones/periodos/${grupoMateriaIdMaestro}/1`;
    expect((await api('/calificaciones/captura', { method: 'POST', token,
      body: { grupoMateriaId: grupoMateriaIdMaestro, parcial: 1, items: [{ alumnoId, calificacion: 91 }] } })).response.status).toBe(400);
    const estado = await api(ruta, { token }); expect(estado.response.status).toBe(200); expect(estado.data.faltantes).toBeGreaterThan(0);
    expect((await api(ruta, { method: 'PATCH', token, body: { estatus: 'CERRADO' } })).response.status).toBe(409);
    const gm = await dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: grupoMateriaIdMaestro });
    const inscritos = await dataSource.getRepository(Inscripcion).findBy({ grupoId: gm.grupoId, estatus: 'ACTIVA' });
    expect((await api('/calificaciones/captura', { method: 'POST', token, body: {
      grupoMateriaId: gm.id, parcial: 1, motivo: 'Corrección verificada', items: inscritos.map((i) => ({ alumnoId: i.alumnoId, calificacion: 91 })),
    } })).response.status).toBe(201);
    expect((await api(ruta, { method: 'PATCH', token, body: { estatus: 'CERRADO' } })).response.status).toBe(200);
    expect((await api('/calificaciones/captura', { method: 'POST', token,
      body: { grupoMateriaId: gm.id, parcial: 1, motivo: 'Intento cerrado', items: [{ alumnoId, calificacion: 90 }] } })).response.status).toBe(409);
    expect((await api(ruta, { method: 'PATCH', token, body: { estatus: 'ABIERTO' } })).response.status).toBe(200);
  });

  it('rota refresh, detecta reutilización y revoca solamente la sesión afectada', async () => {
    const email = (await dataSource.getRepository(Usuario).findOneByOrFail({ id: alumnoUsuarioId })).email;
    const auth = app.get(AuthService);
    const primera = await auth.login(email, 'Integracion_Segura_42!', 'MOVIL');
    const segunda = await auth.login(email, 'Integracion_Segura_42!', 'MOVIL');
    const rotada = await auth.refresh(primera.refreshToken, 'MOVIL');
    expect(rotada.refreshToken).not.toBe(primera.refreshToken);
    await expect(auth.refresh(primera.refreshToken, 'MOVIL')).rejects.toThrow('ya no está activa');
    expect((await api('/auth/me', { token: rotada.accessToken })).response.status).toBe(401);
    expect((await api('/auth/me', { token: segunda.accessToken })).response.status).toBe(200);
    await expect(auth.refresh(segunda.refreshToken, 'WEB')).rejects.toThrow('Refresh inválido');
    expect((await api('/auth/logout', { method: 'POST', token: segunda.accessToken })).response.status).toBe(201);
    await expect(auth.refresh(segunda.refreshToken, 'MOVIL')).rejects.toThrow('ya no está activa');
  });

  it('desactiva al docente y deja sus clases disponibles para reasignación', async () => {
    const token = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId })).email);
    const docente = await dataSource.getRepository(Docente).findOneOrFail({ where: { usuario: { email: `maestro_b_${sufijo}@example.invalid` } } });
    const tokenMaestro = await emitirToken(docente.usuario.email);
    const clase = await dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: grupoMateriaIdMaestro });
    const anterior = clase.docenteId!;
    expect((await api(`/academico/grupo-materias/${clase.id}/docente/${docente.id}`, { method: 'PATCH', token })).response.status).toBe(200);
    expect((await dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: clase.id })).docenteId).toBe(docente.id);
    expect((await api(`/academico/grupo-materias/${clase.id}/docente/${anterior}`, { method: 'PATCH', token })).response.status).toBe(200);
    expect((await api(`/docentes/${docente.id}`, { method: 'PATCH', token, body: { estatus: 'BAJA' } })).response.status).toBe(400);
    expect((await api(`/docentes/${docente.id}/baja`, { method: 'POST', token })).response.status).toBe(201);
    expect((await dataSource.getRepository(Docente).findOneByOrFail({ id: docente.id })).estatus).toBe('BAJA');
    expect((await dataSource.getRepository(Usuario).findOneByOrFail({ id: docente.usuarioId })).activo).toBe(false);
    expect(await dataSource.getRepository(UsuarioPlantel).countBy({ usuarioId: docente.usuarioId, activo: true })).toBe(0);
    expect(await dataSource.getRepository(GrupoMateria).countBy({ docenteId: docente.id })).toBe(0);
    expect((await api('/auth/me', { token: tokenMaestro })).response.status).toBe(401);
    expect((await api(`/academico/grupo-materias/${grupoMateriaIdMaestro}/docente/${docente.id}`, { method: 'PATCH', token })).response.status).toBe(409);
    const inactiva = await dataSource.getRepository(Materia).save(dataSource.getRepository(Materia).create({ clave: `INA${sufijo}`, nombre: 'Materia inactiva', activo: false }));
    const gm = await dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: grupoMateriaIdMaestro });
    expect((await api(`/academico/grupos/${gm.grupoId}/materias`, { method: 'POST', token, body: { materiaId: inactiva.id } })).response.status).toBe(409);
  });

  it('obliga cambio inicial y evita personal sin plantel o roles de expediente sin expediente', async () => {
    const token = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: superadminId })).email);
    const datos = { email: `nuevo_staff_${sufijo}@example.invalid`, nombre: 'Personal', apellidoPaterno: 'Nuevo', password: 'Integracion_Segura_42!' };
    for (const rol of ['ALUMNO', 'MAESTRO', 'FINANZAS']) expect((await api('/usuarios', { method: 'POST', token, body: { ...datos, roles: [rol] } })).response.status).toBe(409);
    const alta = await api('/usuarios', { method: 'POST', token, body: { ...datos, roles: ['ADMINISTRATIVO'], plantelIds: [plantelId] } });
    expect(alta.response.status).toBe(201);
    const auth = app.get(AuthService);
    const temporal = await auth.login(datos.email, datos.password, 'WEB');
    expect(temporal.usuario.passwordChangeRequired).toBe(true);
    expect((await api('/alumnos', { token: temporal.accessToken })).response.status).toBe(403);
    expect((await api('/auth/cambiar-password', { method: 'POST', token: temporal.accessToken,
      body: { actual: datos.password, nueva: 'Nueva_Institucional_42!' } })).response.status).toBe(201);
    expect((await api('/auth/me', { token: temporal.accessToken })).response.status).toBe(401);
    const definitiva = await auth.login(datos.email, 'Nueva_Institucional_42!', 'WEB');
    expect((await api('/alumnos', { token: definitiva.accessToken })).response.status).toBe(200);
  });

  it('cancela cargos y anula pagos manuales con auditoría y recálculo del saldo', async () => {
    const token = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: finanzasId })).email);
    const concepto = await dataSource.getRepository(ConceptoPago).findOneOrFail({ where: { activo: true } });
    const nuevo = await api('/finanzas/cargos', { method: 'POST', token, body: { alumnoId, conceptoId: concepto.id, descripcion: 'Cargo reversible', monto: 50 } });
    expect(nuevo.response.status).toBe(201);
    const cargoId = nuevo.data.id;
    expect((await api('/finanzas/pagos', { method: 'POST', token, body: { alumnoId, monto: 50, metodo: 'EFECTIVO', claveIdempotencia: randomUUID() } })).response.status).toBe(400);
    const pago = await api('/finanzas/pagos', { method: 'POST', token, body: { alumnoId, cargoId, monto: 50, metodo: 'EFECTIVO', claveIdempotencia: randomUUID() } });
    expect(pago.response.status).toBe(201);
    expect((await dataSource.getRepository(Cargo).findOneByOrFail({ id: cargoId })).estatus).toBe('PAGADO');
    expect((await api(`/finanzas/cargos/${cargoId}/cancelacion`, { method: 'POST', token, body: { motivo: 'Error de captura' } })).response.status).toBe(409);
    expect((await api(`/finanzas/pagos/${pago.data.id}/anulacion`, { method: 'POST', token, body: { motivo: 'Error comprobado' } })).response.status).toBe(201);
    expect((await dataSource.getRepository(Cargo).findOneByOrFail({ id: cargoId })).estatus).toBe('PENDIENTE');
    expect((await api(`/finanzas/cargos/${cargoId}/cancelacion`, { method: 'POST', token, body: { motivo: 'Error de captura' } })).response.status).toBe(201);
    expect(await dataSource.getRepository(BitacoraFinanciera).countBy({ accion: 'ANULAR_PAGO', entidadId: pago.data.id, usuarioId: finanzasId })).toBe(1);
    expect(await dataSource.getRepository(BitacoraFinanciera).countBy({ accion: 'CANCELAR_CARGO', entidadId: cargoId, usuarioId: finanzasId })).toBe(1);
  });

  it('separa notas de ciclos, calcula P1-P3 sin Final y exporta inscritos sin nota', async () => {
    const token = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId })).email);
    const movil = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: alumnoUsuarioId })).email);
    const actual = await dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: grupoMateriaIdMaestro });
    const pasado = await dataSource.getRepository(CicloEscolar).findOneOrFail({ where: { activo: false } });
    const grupoPasado = await dataSource.getRepository(Grupo).save(dataSource.getRepository(Grupo).create({ cicloId: pasado.id, plantelId, nombre: `H${sufijo}`, activo: false }));
    const gmPasado = await dataSource.getRepository(GrupoMateria).save(dataSource.getRepository(GrupoMateria).create({ grupoId: grupoPasado.id, materiaId: actual.materiaId }));
    await dataSource.getRepository(Inscripcion).save(dataSource.getRepository(Inscripcion).create({ alumnoId, grupoId: grupoPasado.id, estatus: 'BAJA' }));
    await dataSource.getRepository(Calificacion).save(dataSource.getRepository(Calificacion).create({ alumnoId, grupoMateriaId: gmPasado.id, parcial: 1, calificacion: 17, capturadaPorId: adminId }));
    for (const [parcial, calificacion] of [[1, 60], [2, 90], [3, 90], [0, 100]]) expect((await api('/calificaciones/captura', { method: 'POST', token,
      body: { grupoMateriaId: actual.id, parcial, motivo: 'Prueba de regla oficial', items: [{ alumnoId, calificacion }] } })).response.status).toBe(201);
    const notas = await api('/calificaciones/mias', { token: movil });
    expect(notas.data.some((c: { grupoMateriaId: number }) => c.grupoMateriaId === gmPasado.id)).toBe(false);
    expect(notas.data.filter((c: { grupoMateriaId: number }) => c.grupoMateriaId === actual.id).map((c: { promedioOficial: number }) => c.promedioOficial)).toEqual([80, 80, 80, 80]);
    const historicas = await api(`/calificaciones/mias?cicloId=${pasado.id}`, { token: movil });
    expect(historicas.data.map((c: { grupoMateriaId: number }) => c.grupoMateriaId)).toEqual([gmPasado.id]);
    const sinNota = await api('/alumnos', { method: 'POST', token, body: { nombre: 'Sin', apellidoPaterno: 'Nota', matricula: `SN${sufijo}`,
      email: `sinnota_${sufijo}@example.invalid`, password: 'Integracion_Segura_42!', plantelId } });
    expect((await api(`/academico/grupos/${actual.grupoId}/alumnos`, { method: 'POST', token, body: { alumnoId: sinNota.data.id } })).response.status).toBe(201);
    const response = await fetch(`${baseUrl}/reportes/grupo-materias/${actual.id}/calificaciones.xlsx`, { headers: { authorization: `Bearer ${token}` } });
    expect(response.status).toBe(200);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const rows: unknown[][] = []; workbook.worksheets[0].eachRow((row) => rows.push(row.values as unknown[]));
    expect(rows.some((row) => row.includes(`SN${sufijo}`.toUpperCase()))).toBe(true);
    const matricula = (await dataSource.getRepository(Alumno).findOneByOrFail({ id: alumnoId })).matricula;
    const fila = rows.find((row) => row.includes(matricula));
    expect(fila?.slice(3)).toEqual([60, 90, 90, 100, 80]);
    const propia = await dataSource.getRepository(Inscripcion).findOneByOrFail({ alumnoId, grupoId: actual.grupoId });
    const pdf = await fetch(`${baseUrl}/reportes/boleta/${alumnoId}?cicloId=${actual.grupo.cicloId}&inscripcionId=${propia.id}`, { headers: { authorization: `Bearer ${token}` } });
    expect(pdf.status).toBe(200); expect(pdf.headers.get('content-type')).toContain('application/pdf');
  });

  it('mantiene incidencias exclusivamente internas y restringidas por clase/plantel', async () => {
    const admin = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId })).email);
    const maestro = await emitirToken(`maestro_scope_${sufijo}@example.invalid`);
    const alumno = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: alumnoUsuarioId })).email);
    const finanzas = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: finanzasId })).email);
    const clase = await dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: grupoMateriaIdMaestro });
    const descripcion = 'Nota interna confidencial de seguimiento';
    const creada = await api('/conducta/incidencias', { method: 'POST', token: maestro, body: { alumnoId, grupoId: clase.grupoId, tipo: 'CONVIVENCIA', gravedad: 'LEVE', descripcion, fecha: new Date().toISOString() } });
    expect(creada.response.status).toBe(201);
    expect((await api('/conducta/incidencias', { token: alumno })).response.status).toBe(403);
    expect((await api(`/conducta/incidencias/${creada.data.id}`, { token: alumno })).response.status).toBe(403);
    expect((await api('/conducta/incidencias', { token: finanzas })).response.status).toBe(403);
    expect((await api(`/conducta/incidencias/${creada.data.id}/seguimientos`, { method: 'POST', token: maestro, body: { nota: 'Seguimiento', motivo: 'Verificación', estado: 'CERRADA' } })).response.status).toBe(403);
    const otroDocente = await api('/docentes', { method: 'POST', token: admin, body: { email: `interno_${sufijo}@example.invalid`, password: 'Integracion_Segura_42!', nombre: 'Interno', apellidoPaterno: 'Otro', numEmpleado: `I${sufijo}`, plantelIds: [plantelId] } });
    expect(otroDocente.response.status).toBe(201);
    const otroMaestro = await emitirToken(`interno_${sufijo}@example.invalid`);
    expect((await api(`/conducta/incidencias/${creada.data.id}`, { token: otroMaestro })).response.status).toBe(403);
    expect((await api(`/conducta/incidencias/${creada.data.id}/seguimientos`, { method: 'POST', token: admin, body: { nota: 'Resuelto con seguimiento', motivo: 'Cierre autorizado', estado: 'CERRADA' } })).response.status).toBe(201);
    const detalle = await api(`/conducta/incidencias/${creada.data.id}`, { token: admin });
    expect(detalle.data.seguimientos).toHaveLength(1); expect(detalle.data.estado).toBe('CERRADA');
    expect(JSON.stringify((await api('/notificaciones/mias', { token: alumno })).data)).not.toContain(descripcion);
    const listado = await api('/usuarios/listado?tipo=ALUMNO', { token: maestro });
    expect(listado.response.status).toBe(200); expect(listado.data.datos.length).toBeGreaterThan(0);
    expect(listado.data.datos.every((a: Record<string, unknown>) => !('correo' in a))).toBe(true);
  });

  it('push registra por sesión/dispositivo, deduplica y no admite personal', async () => {
    const alumno = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: alumnoUsuarioId })).email);
    const admin = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId })).email);
    const instalacionId = randomUUID(); const token = `ExponentPushToken[${sufijo}]`;
    const registro = await api('/notificaciones/push/dispositivos', { method: 'POST', token: alumno, body: { instalacionId, token } });
    expect(registro.response.status).toBe(201); expect(registro.data.registrado).toBe(true);
    expect((await api('/notificaciones/push/dispositivos', { method: 'POST', token: alumno, body: { instalacionId, token } })).response.status).toBe(201);
    expect(await dataSource.getRepository(PushDispositivo).countBy({ token, activo: true })).toBe(1);
    expect((await api('/notificaciones/push/dispositivos', { method: 'POST', token: admin, body: { instalacionId: randomUUID(), token: `ExponentPushToken[admin${sufijo}]` } })).response.status).toBe(403);
    const notificacion = await app.get(NotificacionesService).crear(alumnoUsuarioId, 'Aviso público', 'Disponible en la app');
    await app.get(PushService).encolar(notificacion); await app.get(PushService).encolar(notificacion);
    expect(await dataSource.getRepository(PushEnvio).countBy({ notificacionId: notificacion.id })).toBe(1);
    expect((await api(`/notificaciones/push/dispositivos/${instalacionId}`, { method: 'DELETE', token: alumno })).response.status).toBe(200);
    expect(await dataSource.getRepository(PushDispositivo).countBy({ token, activo: true })).toBe(0);
  });

  it('analítica mantiene ciclo y roles sin exponer alumnos ni notas internas', async () => {
    const admin = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId })).email);
    const maestro = await emitirToken(`maestro_scope_${sufijo}@example.invalid`);
    const alumno = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: alumnoUsuarioId })).email);
    const finanzas = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: finanzasId })).email);
    expect((await api('/analitica', { token: alumno })).response.status).toBe(403);
    expect((await api(`/analitica?plantelId=${otroPlantelId}`, { token: admin })).response.status).toBe(403);
    const resultado = await api('/analitica', { token: maestro }); expect(resultado.response.status).toBe(200);
    expect(resultado.data.financiero).toBeUndefined(); expect(resultado.data.academico.clases).toHaveLength(1);
    expect(resultado.data.academico.clases[0]).toMatchObject({ grupoMateriaId: grupoMateriaIdMaestro, promedioOficial: 80, oficialesCompletos: 1 });
    expect(JSON.stringify(resultado.data)).not.toContain('Nota interna confidencial'); expect(JSON.stringify(resultado.data)).not.toContain('@example.invalid');
    const financieros = await api('/analitica', { token: finanzas }); expect(financieros.response.status).toBe(200); expect(financieros.data.academico).toBeUndefined(); expect(financieros.data.financiero.cargos).toBeGreaterThan(0);
  });

  it('importa con preview ligado al actor, valida duplicados y confirma una sola vez', async () => {
    const admin = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId })).email);
    const superadmin = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: superadminId })).email);
    const enviar = (texto: string) => { const f = new FormData(); f.append('tipo', 'ALUMNOS'); f.append('archivo', new Blob([texto]), 'alumnos.csv'); return api('/importaciones/preview', { method: 'POST', token: admin, body: f }); };
    const email = `importado_${sufijo}@example.invalid`;
    const fila = `${email},Importado,Prueba,IMP${sufijo},${plantelId}`;
    const csv = 'email,nombre,apellidoPaterno,matricula,plantelId\n' + fila;
    const duplicado = await enviar(csv + '\n' + fila); expect(duplicado.response.status).toBe(201); expect(duplicado.data.previewId).toBeNull(); expect(duplicado.data.errores).toHaveLength(1);
    expect(await dataSource.getRepository(Usuario).findOneBy({ email })).toBeNull();
    const preview = await enviar(csv); expect(preview.response.status).toBe(201); expect(preview.data.errores).toEqual([]);
    expect((await api('/importaciones/confirmar', { method: 'POST', token: superadmin, body: { previewId: preview.data.previewId, confirmado: true } })).response.status).toBe(404);
    const confirmado = await api('/importaciones/confirmar', { method: 'POST', token: admin, body: { previewId: preview.data.previewId, confirmado: true } }); expect(confirmado.response.status).toBe(201); expect(confirmado.data.insertados).toBe(1);
    expect((await api('/importaciones/confirmar', { method: 'POST', token: admin, body: { previewId: preview.data.previewId, confirmado: true } })).response.status).toBe(404);
    const cuenta = await dataSource.getRepository(Usuario).findOneByOrFail({ email }); expect(cuenta.passwordChangeRequired).toBe(true);
    expect(await dataSource.getRepository(Alumno).countBy({ usuarioId: cuenta.id })).toBe(1);
    expect(await dataSource.getRepository(BitacoraAcademica).countBy({ accion: 'IMPORTAR_ALUMNOS' })).toBe(1);
  });

  it('reactiva alumno sin restaurar inscripciones y docente sin restaurar clases', async () => {
    const admin = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId })).email);
    const alumno = await api('/alumnos', { method: 'POST', token: admin, body: { email: `reactiva_${sufijo}@example.invalid`, password: 'Integracion_Segura_42!', nombre: 'Reactiva', apellidoPaterno: 'Prueba', matricula: `RA${sufijo}`, plantelId } });
    const clase = await dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: grupoMateriaIdMaestro });
    expect((await api(`/academico/grupos/${clase.grupoId}/alumnos`, { method: 'POST', token: admin, body: { alumnoId: alumno.data.id } })).response.status).toBe(201);
    expect((await api(`/alumnos/${alumno.data.id}/baja`, { method: 'POST', token: admin })).response.status).toBe(201);
    const reactivado = await api(`/alumnos/${alumno.data.id}/reactivacion`, { method: 'POST', token: admin, body: { motivo: 'Retorno autorizado' } }); expect(reactivado.response.status).toBe(201);
    const expediente = await dataSource.getRepository(Alumno).findOneByOrFail({ id: alumno.data.id }); expect(expediente.estatus).toBe('ACTIVO'); expect(expediente.usuario.activo).toBe(true);
    expect(await dataSource.getRepository(Inscripcion).countBy({ alumnoId: expediente.id, estatus: 'ACTIVA' })).toBe(0);
    const docente = await dataSource.getRepository(Docente).findOneOrFail({ where: { usuario: { email: `maestro_b_${sufijo}@example.invalid` } } });
    expect(docente.estatus).toBe('BAJA');
    expect((await api(`/docentes/${docente.id}/reactivacion`, { method: 'POST', token: admin, body: { plantelIds: [plantelId], motivo: 'Retorno autorizado' } })).response.status).toBe(201);
    expect((await dataSource.getRepository(Docente).findOneByOrFail({ id: docente.id })).usuario.activo).toBe(true);
    expect(await dataSource.getRepository(GrupoMateria).countBy({ docenteId: docente.id })).toBe(0);
    expect(await dataSource.getRepository(UsuarioPlantel).countBy({ usuarioId: docente.usuarioId, activo: true })).toBe(1);
  });

  it('revierte el lote completo si surge un duplicado después del preview', async () => {
    const admin = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId })).email);
    const email1 = `atomic1_${sufijo}@example.invalid`; const email2 = `atomic2_${sufijo}@example.invalid`;
    const f = new FormData(); f.append('tipo', 'ALUMNOS'); f.append('archivo', new Blob([`email,nombre,apellidoPaterno,matricula,plantelId\n${email1},Primero,Lote,AT1${sufijo},${plantelId}\n${email2},Segundo,Lote,AT2${sufijo},${plantelId}`]), 'lote.csv');
    const preview = await api('/importaciones/preview', { method: 'POST', token: admin, body: f }); expect(preview.data.errores).toEqual([]);
    expect((await api('/alumnos', { method: 'POST', token: admin, body: { email: email2, password: 'Integracion_Segura_42!', nombre: 'Segundo', apellidoPaterno: 'Concurrente', matricula: `OT2${sufijo}`, plantelId } })).response.status).toBe(201);
    expect((await api('/importaciones/confirmar', { method: 'POST', token: admin, body: { previewId: preview.data.previewId, confirmado: true } })).response.status).toBe(409);
    expect(await dataSource.getRepository(Usuario).findOneBy({ email: email1 })).toBeNull(); expect(await dataSource.getRepository(Alumno).countBy({ matricula: `AT1${sufijo}`.toUpperCase() })).toBe(0);
    expect(await dataSource.getRepository(BitacoraAcademica).countBy({ accion: 'IMPORTAR_ALUMNOS' })).toBe(1);
  });

  it('promueve alumnos seleccionados a preparación sin copiar notas ni habilitar el ciclo', async () => {
    const admin = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId })).email);
    const source = await dataSource.getRepository(CicloEscolar).findOneOrFail({ where: { estado: 'CERRADO' } });
    const grupoOrigen = await dataSource.getRepository(Grupo).save(dataSource.getRepository(Grupo).create({ cicloId: source.id, plantelId, nombre: `PRO${sufijo}`, activo: false }));
    await dataSource.getRepository(Inscripcion).insert({ grupoId: grupoOrigen.id, alumnoId, estatus: 'ACTIVA' });
    const ciclo = await api('/academico/ciclos', { method: 'POST', token: admin, body: { clave: `PR${sufijo}`, nombre: 'Siguiente ciclo', fechaInicio: '2031-08-01', fechaFin: '2032-07-31' } }); expect(ciclo.response.status).toBe(201);
    const destino = await api('/academico/grupos', { method: 'POST', token: admin, body: { cicloId: ciclo.data.id, plantelId, nombre: `DEST${sufijo}` } }); expect(destino.response.status).toBe(201);
    const contexto = { origenGrupoId: grupoOrigen.id, destinoGrupoId: destino.data.id };
    const preview = await api('/academico/promocion/preview', { method: 'POST', token: admin, body: contexto }); expect(preview.response.status).toBe(201); expect(preview.data.alumnos).toEqual(expect.arrayContaining([expect.objectContaining({ id: alumnoId, elegible: true })]));
    const confirmacion = await api('/academico/promocion/confirmar', { method: 'POST', token: admin, body: { ...contexto, alumnoIds: [alumnoId], confirmado: true } }); expect(confirmacion.response.status).toBe(201); expect(confirmacion.data.inscritos).toBe(1);
    expect(await dataSource.getRepository(Inscripcion).countBy({ grupoId: destino.data.id, alumnoId, estatus: 'ACTIVA' })).toBe(1);
    expect((await dataSource.getRepository(CicloEscolar).findOneByOrFail({ id: ciclo.data.id })).activo).toBe(false);
    expect((await api('/academico/promocion/confirmar', { method: 'POST', token: admin, body: { ...contexto, alumnoIds: [alumnoId], confirmado: true } })).response.status).toBe(409);
    expect(await dataSource.getRepository(BitacoraAcademica).countBy({ accion: 'PROMOCION_ALUMNO', entidadId: alumnoId })).toBe(1);
  });

  it('recargos respetan la política desactivada por defecto y descuentan beca del cargo', async () => {
    const token = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId })).email);
    const concepto = await api('/finanzas/conceptos', { method: 'POST', token, body: { clave: `POL${sufijo}`, nombre: 'Concepto sin recargo', tipo: 'OTRO', montoBase: 100 } }); expect(concepto.response.status).toBe(201); expect(concepto.data.aplicaRecargo).toBe(false);
    const cargo = await api('/finanzas/cargos', { method: 'POST', token, body: { alumnoId, conceptoId: concepto.data.id, descripcion: 'Cargo de política', monto: 100, descuento: 20, fechaVencimiento: '2020-01-01' } }); expect(cargo.response.status).toBe(201);
    expect((await api('/finanzas/cargos/aplicar-recargos', { method: 'POST', token, body: { plantelId, porcentaje: 10, confirmado: true } })).response.status).toBe(201);
    expect((await dataSource.getRepository(Cargo).findOneByOrFail({ id: cargo.data.id })).recargo).toBe(0);
    expect((await api(`/finanzas/conceptos/${concepto.data.id}`, { method: 'PATCH', token, body: { aplicaRecargo: true } })).response.status).toBe(200);
    expect((await api('/finanzas/cargos/aplicar-recargos', { method: 'POST', token, body: { plantelId, porcentaje: 10, confirmado: true } })).response.status).toBe(201);
    expect((await dataSource.getRepository(Cargo).findOneByOrFail({ id: cargo.data.id })).recargo).toBe(8);
    expect((await api('/finanzas/conceptos', { method: 'POST', token, body: { clave: `BE${sufijo}`, nombre: 'Beca no es deuda', tipo: 'BECA', montoBase: 100 } })).response.status).toBe(400);
  });

  it('gestiona personal con planteles explícitos y revoca la sesión después de corregir el alcance', async () => {
    const root = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: superadminId })).email);
    const alta = await api('/usuarios', { method: 'POST', token: root, body: { email: `personal_edit_${sufijo}@example.invalid`, password: 'Integracion_Segura_42!', nombre: 'Personal', apellidoPaterno: 'Corregible', roles: ['FINANZAS'], plantelIds: [plantelId] } }); expect(alta.response.status).toBe(201);
    const previo = await emitirToken(`personal_edit_${sufijo}@example.invalid`);
    expect((await api(`/usuarios/${alta.data.id}`, { method: 'PATCH', token: root, body: { roles: [] } })).response.status).toBe(409);
    expect((await api(`/usuarios/${alta.data.id}/personal`, { method: 'PATCH', token: root, body: { plantelIds: [], roles: ['FINANZAS'] } })).response.status).toBe(409);
    expect((await api(`/usuarios/${alta.data.id}/personal`, { method: 'PATCH', token: root, body: { plantelIds: [otroPlantelId], roles: ['ADMINISTRATIVO'] } })).response.status).toBe(200);
    expect((await api('/auth/me', { token: previo })).response.status).toBe(401);
    const detalle = await api(`/usuarios/${alta.data.id}/personal`, { token: root }); expect(detalle.data.plantelIds).toEqual([otroPlantelId]); expect(JSON.stringify(detalle.data)).not.toContain('passwordHash');
    expect((await api(`/usuarios/${alumnoUsuarioId}/personal`, { method: 'PATCH', token: root, body: { plantelIds: [plantelId], roles: ['FINANZAS'] } })).response.status).toBe(409);
  });

  it('migra el origen de cargos, órdenes y pagos existentes desde su primera bitácora', async () => {
    const origen = await dataSource.getRepository(Plantel).findOneByOrFail({ clave: 'MIGRACION_FIXTURE' });
    const alumno = await dataSource.getRepository(Alumno).findOneByOrFail({ matricula: 'MIGRACION_LEDGER' });
    expect(alumno.plantelId).not.toBe(origen.id);
    const cargo = await dataSource.getRepository(Cargo).findOneByOrFail({ descripcion: 'LEDGER_PREVIO' });
    const orden = await dataSource.getRepository(OrdenPago).findOneByOrFail({ cargoId: cargo.id });
    const pago = await dataSource.getRepository(Pago).findOneByOrFail({ cargoId: cargo.id });
    expect([cargo.plantelId, orden.plantelId, pago.plantelId]).toEqual([origen.id, origen.id, origen.id]);
  });

  it('mantiene cargos, pagos, permisos y analítica en el plantel de origen después de transferir', async () => {
    const root = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: superadminId })).email);
    const a = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId })).email);
    const b = await emitirFinanzasB();
    const alta = await api('/alumnos', { method: 'POST', token: root, body: { email: `origen_${sufijo}@example.invalid`, password: 'Integracion_Segura_42!', nombre: 'Origen', apellidoPaterno: 'Financiero', matricula: `OF${sufijo}`, plantelId } }); expect(alta.response.status).toBe(201);
    const clase = await dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: grupoMateriaIdMaestro });
    const concepto = await dataSource.getRepository(ConceptoPago).findOneByOrFail({ clave: `CW${sufijo}` });
    const cargo = await api('/finanzas/cargos', { method: 'POST', token: a, body: { alumnoId: alta.data.id, conceptoId: concepto.id, cicloId: clase.grupo.cicloId, descripcion: 'Origen inmutable', monto: 100 } }); expect(cargo.response.status).toBe(201);
    const transfer = await api(`/alumnos/${alta.data.id}/transferencia`, { method: 'POST', token: root, body: { plantelId: otroPlantelId, motivo: 'Cambio de sede' } }); expect(transfer.response.status).toBe(201);
    const dto = { alumnoId: alta.data.id, cargoId: cargo.data.id, monto: 20, metodo: 'EFECTIVO', claveIdempotencia: randomUUID() };
    expect((await api('/finanzas/pagos', { method: 'POST', token: b, body: dto })).response.status).toBe(403);
    const pago = await api('/finanzas/pagos', { method: 'POST', token: a, body: dto }); expect(pago.response.status).toBe(201); expect(pago.data.plantelId).toBe(plantelId);
    const buscador = await api(`/finanzas/alumnos?buscar=OF${sufijo}`, { token: a }); expect(buscador.response.status).toBe(200); expect(buscador.data.datos).toHaveLength(1); expect(JSON.stringify(buscador.data)).not.toContain('@example.invalid');
    const cuentaA = await api(`/finanzas/alumnos/${alta.data.id}/estado-cuenta`, { token: a }); expect(cuentaA.response.status).toBe(200); expect(cuentaA.data.saldoTotal).toBe(80);
    const cuentaB = await api(`/finanzas/alumnos/${alta.data.id}/estado-cuenta`, { token: b }); expect(cuentaB.response.status).toBe(200); expect(cuentaB.data.cargos).toEqual([]); expect(cuentaB.data.pagos).toEqual([]);
    expect((await api(`/finanzas/pagos/${pago.data.id}/anulacion`, { method: 'POST', token: b, body: { motivo: 'Fuera del alcance' } })).response.status).toBe(403);
    expect((await api(`/finanzas/pagos/${pago.data.id}/anulacion`, { method: 'POST', token: a, body: { motivo: 'Corrección autorizada' } })).response.status).toBe(201);
    expect((await dataSource.getRepository(Cargo).findOneByOrFail({ id: cargo.data.id })).plantelId).toBe(plantelId);
  });

  it('analítica histórica conserva materia desactivada y participación de alumno de baja', async () => {
    const root = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: superadminId })).email);
    const ciclo = await dataSource.getRepository(CicloEscolar).save({ clave: `AH${sufijo}`, nombre: 'Histórico analítico', fechaInicio: '2023-01-01', fechaFin: '2023-12-31', activo: false, estado: 'CERRADO' });
    const grupo = await dataSource.getRepository(Grupo).save({ cicloId: ciclo.id, plantelId, nombre: 'Histórico', activo: false });
    const materia = await dataSource.getRepository(Materia).save({ clave: `AH${sufijo}`, nombre: 'Materia retirada', activo: false, creditos: 0 });
    const clase = await dataSource.getRepository(GrupoMateria).save({ grupoId: grupo.id, materiaId: materia.id, docenteId: null });
    await dataSource.getRepository(Inscripcion).save({ alumnoId, grupoId: grupo.id, estatus: 'BAJA' });
    for (const parcial of [1,2,3]) await dataSource.getRepository(Calificacion).save({ alumnoId, grupoMateriaId: clase.id, parcial, calificacion: [80.05, 80.15, 80.25][parcial-1], capturadaPorId: adminId });
    const resultado = await api(`/analitica?cicloId=${ciclo.id}`, { token: root }); expect(resultado.response.status).toBe(200); expect(resultado.data.modo).toBe('HISTORICO'); expect(resultado.data.academico.clases).toEqual([expect.objectContaining({ materia: 'Materia retirada', inscritos: 1, participantesHistoricos: 1, inscritosVigentes: 0, promedioOficial: 80.2 })]);
  });

  it('recupera push pendiente después de fallar la cola sin duplicar envíos', async () => {
    const push = app.get(PushService); const fallo = jest.spyOn(push, 'encolar').mockRejectedValueOnce(new Error('Fallo transitorio de DB'));
    const n = await app.get(NotificacionesService).crear(alumnoUsuarioId, 'Aviso recuperable', 'Contenido solo en app');
    expect((await dataSource.getRepository(Notificacion).findOneByOrFail({ id: n.id })).pushPendiente).toBe(true); fallo.mockRestore();
    await push.recuperar(); await push.recuperar();
    expect((await dataSource.getRepository(Notificacion).findOneByOrFail({ id: n.id })).pushPendiente).toBe(false);
    // El caso previo desactivó la instalación; registrar una activa prueba la recuperación con destinatario real.
    const token = await emitirToken((await dataSource.getRepository(Usuario).findOneByOrFail({ id: alumnoUsuarioId })).email);
    await api('/notificaciones/push/dispositivos', { method: 'POST', token, body: { instalacionId: randomUUID(), token: `ExponentPushToken[retry${sufijo}]` } });
    const fallo2 = jest.spyOn(push, 'encolar').mockRejectedValueOnce(new Error('Fallo de cola'));
    const nueva = await app.get(NotificacionesService).crear(alumnoUsuarioId, 'Aviso durable', 'Información interna'); fallo2.mockRestore(); await push.recuperar(); await push.recuperar();
    expect(await dataSource.getRepository(PushEnvio).countBy({ notificacionId: nueva.id })).toBe(1);
  });

  it('cobranza deduplica, conserva éxito parcial y exige revisión de timeout antes de reenviar', async () => {
    const usuario = await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId }); const token = await emitirToken(usuario.email);
    await dataSource.getRepository(PlantillaCorreo).save({ clave: 'AVISO_ADEUDO', asunto: 'Aviso {{institucion}}', cuerpoHtml: '<p>{{nombre}} {{saldo}}</p>' });
    const servicio = app.get(CobranzaService);
    const primera = await api('/finanzas/avisos-cobranza', { method: 'POST', token, body: { plantelId, confirmado: true } }); expect(primera.response.status).toBe(201); expect(primera.data.programados).toBeGreaterThan(0);
    const repetida = await api('/finanzas/avisos-cobranza', { method: 'POST', token, body: { plantelId, confirmado: true } }); expect(repetida.data.programados).toBe(0);
    await dataSource.getRepository(CobranzaEnvio).update({ estado: 'PENDIENTE' }, { proximoIntento: new Date(0) });
    const smtp = jest.spyOn(app.get(NotificacionesService), 'enviarEmail').mockResolvedValueOnce({ simulado: false }).mockRejectedValueOnce(new Error('Timeout después de DATA')).mockResolvedValue({ simulado: false });
    await servicio.procesar(); const cantidad = smtp.mock.calls.length; expect(cantidad).toBeGreaterThan(1); await servicio.procesar(); expect(smtp).toHaveBeenCalledTimes(cantidad); smtp.mockRestore();
    expect(await dataSource.getRepository(CobranzaEnvio).countBy({ estado: 'ENVIADO' })).toBeGreaterThan(0);
    const incierto = await dataSource.getRepository(CobranzaEnvio).findOneByOrFail({ estado: 'INCIERTO' });
    const b = await emitirFinanzasB();
    expect((await api(`/finanzas/cobranza/envios/${incierto.id}/reintento`, { method: 'POST', token: b, body: { motivo: 'Intento no autorizado', confirmado: true } })).response.status).toBe(403);
    expect((await api(`/finanzas/cobranza/envios/${incierto.id}/reintento`, { method: 'POST', token, body: { motivo: 'Revisado con proveedor', confirmado: false } })).response.status).toBe(400);
    expect((await api(`/finanzas/cobranza/envios/${incierto.id}/reintento`, { method: 'POST', token, body: { motivo: 'Proveedor confirmó que no recibió', confirmado: true } })).response.status).toBe(201);
    const repo = dataSource.getRepository(CobranzaEnvio);
    const rechazo = jest.spyOn(app.get(NotificacionesService), 'enviarEmail').mockRejectedValue(Object.assign(new Error('Rechazo temporal'), { responseCode: 450 }));
    try {
      for (let intento = 1; intento <= 3; intento++) {
        await repo.update(incierto.id, { proximoIntento: new Date(0) }); await servicio.procesar();
        const actual = await repo.findOneByOrFail({ id: incierto.id });
        expect(actual.intentos).toBe(intento); expect(actual.estado).toBe(intento < 3 ? 'PENDIENTE' : 'ERROR');
      }
      await servicio.procesar(); expect(rechazo).toHaveBeenCalledTimes(3);
      // Un proceso interrumpido debe conservar el resultado incierto y auditarlo sin reenviar.
      await repo.update(incierto.id, { estado: 'ENVIANDO', proximoIntento: new Date(0) }); await servicio.procesar();
      expect((await repo.findOneByOrFail({ id: incierto.id })).estado).toBe('INCIERTO'); expect(rechazo).toHaveBeenCalledTimes(3);
      expect(await dataSource.getRepository(BitacoraFinanciera).existsBy({ accion: 'COBRANZA_INCIERTO', entidadId: incierto.id, detalle: 'ENVIO_INTERRUMPIDO_VERIFICAR_PROVEEDOR' })).toBe(true);
    } finally { rechazo.mockRestore(); }
  });

  it('carga controlada: 100 alumnos, 900 notas y capturas concurrentes sin alterar promedios', async () => {
    const admin = await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId }); const token = await emitirToken(admin.email);
    const base = await dataSource.getRepository(GrupoMateria).findOneByOrFail({ id: grupoMateriaIdMaestro });
    const grupo = await dataSource.getRepository(Grupo).save({ plantelId, cicloId: base.grupo.cicloId, nombre: `Carga-${sufijo}`, activo: true });
    const alumnosCarga: number[] = [];
    const passwordHash = await bcrypt.hash('Integracion_Segura_42!', 4);
    for (let i = 0; i < 100; i++) {
      const u = await dataSource.getRepository(Usuario).save({ email: `carga${i}_${sufijo}@example.invalid`, nombre: 'Carga', apellidoPaterno: String(i), passwordHash, activo: true });
      const a = await dataSource.getRepository(Alumno).save({ usuarioId: u.id, plantelId, matricula: `L${i}${sufijo}`, estatus: 'ACTIVO' }); alumnosCarga.push(a.id);
    }
    await dataSource.getRepository(Inscripcion).save(alumnosCarga.map((id) => ({ alumnoId: id, grupoId: grupo.id, estatus: 'ACTIVA' as const })));
    const clases: number[] = [];
    for (let i = 0; i < 3; i++) {
      const materia = await dataSource.getRepository(Materia).save({ clave: `L${i}${sufijo}`, nombre: `Carga ${i}`, creditos: 0, activo: true });
      clases.push((await dataSource.getRepository(GrupoMateria).save({ grupoId: grupo.id, materiaId: materia.id, docenteId: null })).id);
    }
    const tiempos: number[] = [];
    for (const parcial of [1,2,3]) await Promise.all(clases.map(async (id) => {
      const desde = Date.now(); const r = await api('/calificaciones/captura', { method: 'POST', token, body: { grupoMateriaId: id, parcial, items: alumnosCarga.map((alumnoId) => ({ alumnoId, calificacion: 80 })) } });
      tiempos.push(Date.now() - desde); expect(r.response.status).toBe(201);
    }));
    const desde = Date.now(); const resultado = await api(`/analitica?grupoId=${grupo.id}`, { token }); const analiticaMs = Date.now() - desde;
    expect(resultado.response.status).toBe(200); expect(resultado.data.academico.clases).toHaveLength(3);
    for (const c of resultado.data.academico.clases) expect(c).toMatchObject({ inscritos: 100, oficialesCompletos: 100, promedioOficial: 80 });
    expect(await dataSource.getRepository(Calificacion).countBy({ grupoMateriaId: require('typeorm').In(clases) })).toBe(900);
    tiempos.sort((a,b) => a-b); console.log(JSON.stringify({ prueba: 'carga_aislada', motor: process.env.DB_TYPE, alumnos: 100, clases: 3, notas: 900, concurrencia: 3, capturasP95Ms: tiempos[Math.ceil(tiempos.length * .95)-1], analiticaMs }));
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
