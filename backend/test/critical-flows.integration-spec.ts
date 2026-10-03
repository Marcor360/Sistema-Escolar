import { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { AddressInfo } from 'net';
import { basename, resolve } from 'path';
import { readFileSync, unlinkSync } from 'fs';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import {
  Alumno, Cargo, CicloEscolar, ConceptoPago, Grupo, GrupoMateria, Inscripcion,
  Docente, Materia, Material, Notificacion, OrdenPago, Pago, Plantel, Rol, Usuario, UsuarioPlantel,
} from '../src/entities';
import { AppModule } from '../src/app.module';

const dbName = process.env.DB_NAME ?? '';

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
    } finally {
      await pool.close();
    }
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
  } finally {
    await conexion.end();
  }
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

  const emitirToken = async (email: string) => {
    const usuario = await dataSource.getRepository(Usuario).findOneOrFail({
      where: { email },
      relations: ['roles'],
    });
    return app.get(JwtService).sign({
      sub: usuario.id,
      email: usuario.email,
      nombre: usuario.nombreCompleto,
      roles: usuario.roles.map((rol) => rol.clave),
      ver: usuario.sessionVersion ?? 0,
    });
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
    await conceptos.save(conceptos.create({
      clave: 'COL', nombre: 'Colegiatura integracion', tipo: 'COLEGIATURA', montoBase: 100,
    }));
    const body = { cicloId: ciclo.id, periodo: '2026-09', monto: 100 };
    const [primera, segunda] = await Promise.all([
      api('/finanzas/cargos/generar-colegiaturas', { method: 'POST', token, body }),
      api('/finanzas/cargos/generar-colegiaturas', { method: 'POST', token, body }),
    ]);

    expect(primera.response.status).toBe(201);
    expect(segunda.response.status).toBe(201);
    expect(primera.data.generados + segunda.data.generados).toBe(1);
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
      body: { alumnoId, cargoId: cargoWebhookId, monto: 125, metodo: 'EFECTIVO', referencia: `MAN${sufijo}` },
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

    const parcial = await api('/finanzas/pagos', {
      method: 'POST', token,
      body: { alumnoId, cargoId: cargo.data.id, monto: 50, metodo: 'TRANSFERENCIA', referencia: `INT${sufijo}` },
    });
    expect(parcial.response.status).toBe(201);
    const excedente = await api('/finanzas/pagos', {
      method: 'POST', token,
      body: { alumnoId, cargoId: cargo.data.id, monto: 150.01, metodo: 'EFECTIVO', referencia: `EXC${sufijo}` },
    });
    expect(excedente.response.status).toBe(400);
    expect((await dataSource.getRepository(Cargo).findOneByOrFail({ id: cargo.data.id })).estatus).toBe('PARCIAL');
    expect(await dataSource.getRepository(Pago).countBy({ cargoId: cargo.data.id })).toBe(1);
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
});
