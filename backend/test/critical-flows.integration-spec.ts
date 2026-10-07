import { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { NestFactory } from '@nestjs/core';
import * as ExcelJS from 'exceljs';
import { BitacoraFinanciera } from '../src/entities/bitacora-financiera.entity';
import { AuthService } from '../src/auth/auth.service';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { AddressInfo } from 'net';
import { basename, resolve } from 'path';
import { readFileSync, unlinkSync } from 'fs';
import { spawn, spawnSync } from 'child_process';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import {
  Alumno, Calificacion, Cargo, CicloEscolar, ConceptoPago, Grupo, GrupoMateria, Inscripcion,
  Docente, Entrega, Materia, Material, Notificacion, OrdenPago, Pago, Plantel, Rol, Usuario, UsuarioPlantel,
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
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'solo-para-pruebas-integrales';
    process.env.UPLOADS_DIR = process.env.UPLOADS_DIR || 'uploads';
    if (process.env.DB_TYPE === 'mssql') await esperarYCrearBaseSqlServer();
    await instalarBaseline();

    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
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
        alumnoId, conceptoId: concepto.id, cicloId: null, periodo: null,
        descripcion: 'Cargo webhook de integración', monto: 125, descuento: 0, recargo: 0,
        fechaVencimiento: null, estatus: 'PENDIENTE',
      }),
    );
    cargoWebhookId = cargo.id;
    const orden = await dataSource.getRepository(OrdenPago).save(
      dataSource.getRepository(OrdenPago).create({
        alumnoId, cargoId: cargo.id, monto: 125, descripcion: cargo.descripcion,
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

  it('mantiene un solo ciclo activo al crear y actualizar ciclos', async () => {
    const admin = await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId });
    const token = await emitirToken(admin.email);
    const primero = await api('/academico/ciclos', {
      method: 'POST', token,
      body: { clave: `A${sufijo}`, nombre: 'Ciclo activo uno', fechaInicio: '2026-08-01', fechaFin: '2027-07-31', activo: true },
    });
    const segundo = await api('/academico/ciclos', {
      method: 'POST', token,
      body: { clave: `B${sufijo}`, nombre: 'Ciclo activo dos', fechaInicio: '2027-08-01', fechaFin: '2028-07-31', activo: true },
    });
    expect(primero.response.status).toBe(201);
    expect(segundo.response.status).toBe(201);
    expect(await dataSource.getRepository(CicloEscolar).countBy({ activo: true })).toBe(1);
    const reactivado = await api(`/academico/ciclos/${primero.data.id}`, {
      method: 'PATCH', token, body: { activo: true },
    });
    expect(reactivado.response.status).toBe(200);
    expect(await dataSource.getRepository(CicloEscolar).countBy({ activo: true })).toBe(1);

    const ciclosConcurrentes = await Promise.all([
      api('/academico/ciclos', {
        method: 'POST', token,
        body: { clave: `D${sufijo}`, nombre: 'Ciclo concurrente uno', fechaInicio: '2028-08-01', fechaFin: '2029-07-31', activo: true },
      }),
      api('/academico/ciclos', {
        method: 'POST', token,
        body: { clave: `E${sufijo}`, nombre: 'Ciclo concurrente dos', fechaInicio: '2029-08-01', fechaFin: '2030-07-31', activo: true },
      }),
    ]);
    expect(ciclosConcurrentes.some(({ response }) => response.status === 201)).toBe(true);
    expect(ciclosConcurrentes.every(({ response }) => [201, 409].includes(response.status))).toBe(true);
    const ciclosActivosConcurrentes = await dataSource.getRepository(CicloEscolar).findBy({ activo: true });
    expect(ciclosActivosConcurrentes.filter(({ clave }) => [`D${sufijo}`, `E${sufijo}`].map((c) => c.toUpperCase()).includes(clave))).toHaveLength(1);
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
      body: { clave: `C${sufijo}`, nombre: 'Ciclo de integración', fechaInicio: '2026-08-01', fechaFin: '2027-07-31', activo: true },
    });
    expect(ciclo.response.status).toBe(201);
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
        clave: `TX${sufijo}`, nombre: 'Concepto transaccional', tipo: 'OTRO', montoBase: 100,
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
    const cerrado = await dataSource.getRepository(CicloEscolar).findOneOrFail({ where: { activo: false } });
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

});
