/**
 * Seed de datos: roles, catálogos, superadmin y datos demo end-to-end
 * (docente, alumnos, ciclo, grupo, materia, cargos).
 * Uso exclusivo en desarrollo: npm run seed (requiere esquema migrado; nunca DB_SYNC=true en producción)
 */
import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
loadEnv();

import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as bcrypt from 'bcryptjs';
import { join } from 'path';
import {
  Rol, Usuario, Alumno, Docente, CicloEscolar, Materia, Grupo, GrupoMateria,
  Inscripcion, ConceptoPago, Cargo, PlantillaCorreo, Plantel, UsuarioPlantel,
  ConfiguracionMarca,
} from '../entities';

const type = (process.env.DB_TYPE || 'mysql') as 'mysql' | 'mssql';

const dataSource = new DataSource({
  type,
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || (type === 'mssql' ? 1433 : 3306),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'escolar',
  entities: [join(__dirname, '..', 'entities', '*.entity{.ts,.js}')],
  synchronize: process.env.DB_SYNC === 'true',
  namingStrategy: new SnakeNamingStrategy(),
  ...(type === 'mssql' ? { options: { encrypt: false, trustServerCertificate: true } } : {}),
} as any);

async function main() {
  await dataSource.initialize();
  console.log(`Conectado a ${type} — sembrando datos…`);

  // ---- Identidad institucional ----
  const marcaRepo = dataSource.getRepository(ConfiguracionMarca);
  if (!(await marcaRepo.count({ where: { id: 1 } }))) {
    await marcaRepo.save(marcaRepo.create({
      id: 1,
      nombreInstitucion: 'Sistema Escolar',
      nombreCorto: 'SE',
      logoUrl: null,
      colorPrimario: '#14343B',
      colorAcento: '#C79A3C',
    }));
  }

  // ---- Roles ----
  const rolesRepo = dataSource.getRepository(Rol);
  const claves: Array<[string, string]> = [
    ['ALUMNO', 'Alumno'], ['MAESTRO', 'Maestro'], ['ADMINISTRATIVO', 'Administrativo'],
    ['FINANZAS', 'Finanzas'], ['SUPERADMIN', 'Superadministrador'],
  ];
  const roles = new Map<string, Rol>();
  for (const [clave, nombre] of claves) {
    let rol = await rolesRepo.findOne({ where: { clave } });
    if (!rol) rol = await rolesRepo.save(rolesRepo.create({ clave, nombre }));
    roles.set(clave, rol);
  }

  // ---- Conceptos ----
  const conceptosRepo = dataSource.getRepository(ConceptoPago);
  const conceptos: Array<[string, string, ConceptoPago['tipo'], number]> = [
    ['INS', 'Inscripción', 'INSCRIPCION', 3500],
    ['COL', 'Colegiatura mensual', 'COLEGIATURA', 2800],
    ['REC', 'Recargo por mora', 'RECARGO', 0],
    ['DESC', 'Descuento', 'DESCUENTO', 0],
    ['BECA', 'Beca', 'BECA', 0],
  ];
  for (const [clave, nombre, tipo, montoBase] of conceptos) {
    const existe = await conceptosRepo.findOne({ where: { clave } });
    if (!existe) await conceptosRepo.save(conceptosRepo.create({ clave, nombre, tipo, montoBase }));
  }

  // ---- Plantilla de cobranza ----
  const plantillasRepo = dataSource.getRepository(PlantillaCorreo);
  if (!(await plantillasRepo.findOne({ where: { clave: 'AVISO_ADEUDO' } }))) {
    await plantillasRepo.save(plantillasRepo.create({
      clave: 'AVISO_ADEUDO',
      asunto: 'Aviso de adeudo — {{institucion}}',
      cuerpoHtml:
        '<p>Estimado(a) {{nombre}}:</p><p>Le recordamos que presenta un saldo pendiente de <b>${{saldo}} MXN</b>. ' +
        'Puede realizar su pago en línea o en ventanilla.</p><p>Si ya realizó su pago, haga caso omiso de este aviso.</p><p>{{institucion}}</p>',
    }));
  }

  // ---- Usuarios ----
  const usuariosRepo = dataSource.getRepository(Usuario);
  const crearUsuario = async (email: string, password: string, nombre: string, ap: string, rolClaves: string[]) => {
    let usuario = await usuariosRepo.findOne({ where: { email } });
    if (usuario) return usuario;
    usuario = await usuariosRepo.save(usuariosRepo.create({
      email,
      passwordHash: await bcrypt.hash(password, 10),
      nombre,
      apellidoPaterno: ap,
      roles: rolClaves.map((c) => roles.get(c)!),
    }));
    console.log(`  usuario: ${email} / ${password}`);
    return usuario;
  };

  const admin = await crearUsuario(
    process.env.SEED_ADMIN_EMAIL || 'admin@escuela.mx',
    process.env.SEED_ADMIN_PASSWORD || 'Admin123!',
    'Administrador', 'General',
    ['SUPERADMIN', 'ADMINISTRATIVO', 'FINANZAS'],
  );
  void admin;

  const coordinadora = await crearUsuario(
    'coordinacion.naucalpan@escuela.mx', 'Coordina123!', 'Coordinación', 'Naucalpan', ['ADMINISTRATIVO'],
  );
  const uDocente = await crearUsuario('maestro@escuela.mx', 'Maestro123!', 'Laura', 'Mendoza', ['MAESTRO']);
  const uAlumno1 = await crearUsuario('alumno1@escuela.mx', 'Alumno123!', 'Carlos', 'Ramírez', ['ALUMNO']);
  const uAlumno2 = await crearUsuario('alumno2@escuela.mx', 'Alumno123!', 'María', 'Torres', ['ALUMNO']);

  // ---- Planteles demo (solo desarrollo) ----
  const plantelesRepo = dataSource.getRepository(Plantel);
  const asegurarPlantel = async (clave: string, nombre: string, municipio: string) => {
    let plantel = await plantelesRepo.findOne({ where: { clave } });
    if (!plantel) plantel = await plantelesRepo.save(plantelesRepo.create({ clave, nombre, municipio }));
    return plantel;
  };
  const naucalpan = await asegurarPlantel('NAU', 'Naucalpan', 'Naucalpan de Juárez');
  const losReyes = await asegurarPlantel('REY', 'Los Reyes', 'La Paz');
  await asegurarPlantel('CEN', 'Centro', 'Ciudad de México');

  const asignacionesRepo = dataSource.getRepository(UsuarioPlantel);
  const asignar = async (usuarioId: number, plantelId: number) => {
    let asignacion = await asignacionesRepo.findOne({ where: { usuarioId, plantelId } });
    if (!asignacion) asignacion = asignacionesRepo.create({ usuarioId, plantelId, activo: true });
    asignacion.activo = true;
    await asignacionesRepo.save(asignacion);
  };
  await asignar(coordinadora.id, naucalpan.id);
  await asignar(uDocente.id, naucalpan.id);
  if (naucalpan.directorUsuarioId !== coordinadora.id) {
    naucalpan.directorUsuarioId = coordinadora.id;
    await plantelesRepo.save(naucalpan);
  }

  // ---- Expedientes ----
  const docentesRepo = dataSource.getRepository(Docente);
  let docente = await docentesRepo.findOne({ where: { usuarioId: uDocente.id } });
  if (!docente) docente = await docentesRepo.save(docentesRepo.create({ usuarioId: uDocente.id, numEmpleado: 'D-0001', especialidad: 'Matemáticas' }));

  const alumnosRepo = dataSource.getRepository(Alumno);
  const asegurarAlumno = async (usuarioId: number, matricula: string, plantelId: number) => {
    let alumno = await alumnosRepo.findOne({ where: { usuarioId } });
    if (!alumno) alumno = alumnosRepo.create({ usuarioId, matricula, plantelId });
    alumno.plantelId = plantelId;
    alumno = await alumnosRepo.save(alumno);
    return alumno;
  };
  const alumno1 = await asegurarAlumno(uAlumno1.id, 'A-2026-001', naucalpan.id);
  const alumno2 = await asegurarAlumno(uAlumno2.id, 'A-2026-002', losReyes.id);

  // ---- Estructura académica demo ----
  const ciclosRepo = dataSource.getRepository(CicloEscolar);
  let ciclo = await ciclosRepo.findOne({ where: { clave: '2026-2027' } });
  if (!ciclo) {
    ciclo = await ciclosRepo.save(ciclosRepo.create({
      clave: '2026-2027', nombre: 'Ciclo escolar 2026-2027',
      fechaInicio: '2026-08-24', fechaFin: '2027-07-09', activo: true,
    }));
  }

  const materiasRepo = dataSource.getRepository(Materia);
  let materia = await materiasRepo.findOne({ where: { clave: 'MAT-101' } });
  if (!materia) materia = await materiasRepo.save(materiasRepo.create({ clave: 'MAT-101', nombre: 'Matemáticas I', creditos: 8 }));

  const gruposRepo = dataSource.getRepository(Grupo);
  let grupo = await gruposRepo.findOne({ where: { cicloId: ciclo.id, nombre: '1-A' } });
  if (!grupo) grupo = gruposRepo.create({ cicloId: ciclo.id, plantelId: naucalpan.id, nombre: '1-A', grado: '1', turno: 'MATUTINO' });
  grupo.plantelId = naucalpan.id;
  grupo = await gruposRepo.save(grupo);
  let grupoB = await gruposRepo.findOne({ where: { cicloId: ciclo.id, nombre: '1-B' } });
  if (!grupoB) grupoB = await gruposRepo.save(gruposRepo.create({ cicloId: ciclo.id, plantelId: losReyes.id, nombre: '1-B', grado: '1', turno: 'MATUTINO' }));
  else if (grupoB.plantelId !== losReyes.id) { grupoB.plantelId = losReyes.id; grupoB = await gruposRepo.save(grupoB); }

  const gmRepo = dataSource.getRepository(GrupoMateria);
  let gm = await gmRepo.findOne({ where: { grupoId: grupo.id, materiaId: materia.id } });
  if (!gm) gm = await gmRepo.save(gmRepo.create({ grupoId: grupo.id, materiaId: materia.id, docenteId: docente.id }));

  const inscRepo = dataSource.getRepository(Inscripcion);
  const asegurarInscripcion = async (alumnoId: number, grupoId: number) => {
    let existe = await inscRepo.findOne({ where: { alumnoId, grupoId } });
    if (!existe) existe = inscRepo.create({ alumnoId, grupoId });
    existe.estatus = 'ACTIVA';
    await inscRepo.save(existe);
  };
  await asegurarInscripcion(alumno1.id, grupo.id);
  const anteriorAlumno2 = await inscRepo.findOne({ where: { alumnoId: alumno2.id, grupoId: grupo.id } });
  if (anteriorAlumno2) { anteriorAlumno2.estatus = 'BAJA'; await inscRepo.save(anteriorAlumno2); }
  await asegurarInscripcion(alumno2.id, grupoB.id);

  // ---- Cargo demo de inscripción ----
  const cargosRepo = dataSource.getRepository(Cargo);
  const conceptoIns = await conceptosRepo.findOne({ where: { clave: 'INS' } });
  for (const alumno of [alumno1, alumno2]) {
    const existe = await cargosRepo.findOne({ where: { alumnoId: alumno.id, conceptoId: conceptoIns!.id } });
    if (!existe) {
      await cargosRepo.save(cargosRepo.create({
        alumnoId: alumno.id,
        conceptoId: conceptoIns!.id,
        cicloId: ciclo.id,
        descripcion: 'Inscripción ciclo 2026-2027',
        monto: conceptoIns!.montoBase,
        fechaVencimiento: '2026-08-31',
      }));
    }
  }

  console.log('Seed completado.');
  await dataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
