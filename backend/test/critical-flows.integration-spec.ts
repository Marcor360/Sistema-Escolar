import { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { AddressInfo } from 'net';
import { basename, resolve } from 'path';
import { unlinkSync } from 'fs';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import {
  Alumno, Cargo, CicloEscolar, ConceptoPago, Grupo, GrupoMateria, Inscripcion,
  Materia, Material, Notificacion, OrdenPago, Pago, Plantel, Rol, Usuario, UsuarioPlantel,
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

describe('Integración de flujos críticos (base aislada)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let baseUrl: string;
  let sufijo: string;
  let plantelId: number;
  let otroPlantelId: number;
  let adminId: number;
  let alumnoId: number;
  let alumnoUsuarioId: number;
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

  const login = async (email: string, password: string, portal: 'WEB' | 'MOVIL' = 'WEB') => {
    const { response, data } = await api('/auth/login', {
      method: 'POST', headers: { 'x-portal': portal }, body: { email, password },
    });
    expect(response.status).toBe(201);
    return data.accessToken as string;
  };

  beforeAll(async () => {
    if (process.env.RUN_DB_INTEGRATION !== '1') {
      throw new Error('Define RUN_DB_INTEGRATION=1 para habilitar pruebas contra la base aislada');
    }
    if (!/^escolar_integration_[a-z0-9_]+$/i.test(dbName)) {
      throw new Error('DB_NAME debe comenzar con escolar_integration_; se rechaza cualquier otra base');
    }
    if (process.env.DB_SYNC !== 'true' || process.env.NODE_ENV === 'production') {
      throw new Error('La integración solo se permite en base aislada con NODE_ENV de pruebas y DB_SYNC=true');
    }
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'solo-para-pruebas-integrales';
    process.env.UPLOADS_DIR = process.env.UPLOADS_DIR || 'uploads';
    if (process.env.DB_TYPE === 'mssql') await esperarYCrearBaseSqlServer();

    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
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

    const alumnoUsuario = await usuarios.save(usuarios.create({
      email: `alumno_${sufijo}@example.invalid`, passwordHash, nombre: 'Alumno', apellidoPaterno: 'Integración',
      apellidoMaterno: null, telefono: null, activo: true, roles: [alumnoRole],
    }));
    alumnoUsuarioId = alumnoUsuario.id;
    const alumno = await dataSource.getRepository(Alumno).save(
      dataSource.getRepository(Alumno).create({
        usuarioId: alumnoUsuario.id, plantelId, matricula: `M${sufijo}`,
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
    const token = await login(admin.email, password);

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

  it('expone disponibilidad con verificación real de la base', async () => {
    const health = await api('/health');
    expect(health.response.status).toBe(200);
    expect(health.data).toEqual({ status: 'ok', database: 'ok' });
  });

  it('inscribe a un alumno, captura una calificación y la muestra en su portal', async () => {
    const admin = await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId });
    const alumnoUsuario = await dataSource.getRepository(Usuario).findOneByOrFail({ id: alumnoUsuarioId });
    const tokenAdmin = await login(admin.email, 'Integracion_Segura_42!');
    const tokenAlumno = await login(alumnoUsuario.email, 'Integracion_Segura_42!', 'MOVIL');

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

  it('registra un cargo y un pago parcial desde el flujo financiero', async () => {
    const admin = await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId });
    const token = await login(admin.email, 'Integracion_Segura_42!');
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
    const pago = await api('/finanzas/pagos', {
      method: 'POST', token,
      body: { alumnoId, cargoId: cargo.data.id, monto: 50, metodo: 'TRANSFERENCIA', referencia: `INT${sufijo}` },
    });
    expect(pago.response.status).toBe(201);
    expect((await dataSource.getRepository(Cargo).findOneByOrFail({ id: cargo.data.id })).estatus).toBe('PARCIAL');
    const estado = await api(`/finanzas/alumnos/${alumnoId}/estado-cuenta`, { token });
    expect(estado.response.status).toBe(200);
    expect(estado.data.cargos).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: cargo.data.id, pagado: 50, saldo: 150 }),
    ]));
  });

  it('entrega materiales solo a un alumno inscrito y sirve el enlace firmado', async () => {
    const admin = await dataSource.getRepository(Usuario).findOneByOrFail({ id: adminId });
    const alumnoUsuario = await dataSource.getRepository(Usuario).findOneByOrFail({ id: alumnoUsuarioId });
    const tokenAdmin = await login(admin.email, 'Integracion_Segura_42!');
    const tokenAlumno = await login(alumnoUsuario.email, 'Integracion_Segura_42!', 'MOVIL');
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

  it('registra un único pago y aviso si Openpay reenvía charge.succeeded', async () => {
    const orden = await dataSource.getRepository(OrdenPago).findOneByOrFail({ id: ordenId });
    const evento = { type: 'charge.succeeded', transaction: { id: orden.idExterno, amount: 125 } };
    const primera = await api('/finanzas/webhook/openpay', { method: 'POST', body: evento });
    const segunda = await api('/finanzas/webhook/openpay', { method: 'POST', body: evento });

    expect(primera.response.status).toBe(200);
    expect(segunda.response.status).toBe(200);
    expect(await dataSource.getRepository(Pago).countBy({ ordenPagoId: ordenId })).toBe(1);
    expect(await dataSource.getRepository(Notificacion).countBy({ usuarioId: alumnoUsuarioId })).toBe(1);
    expect((await dataSource.getRepository(OrdenPago).findOneByOrFail({ id: ordenId })).estatus).toBe('COMPLETADA');
    expect((await dataSource.getRepository(Cargo).findOneByOrFail({ id: cargoWebhookId })).estatus).toBe('PAGADO');
  });
});
