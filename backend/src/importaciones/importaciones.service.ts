import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomBytes, randomUUID } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CrearAlumnoDto } from '../alumnos/alumnos.dto';
import { CrearDocenteDto } from '../docentes/docentes.dto';
import { CrearUsuarioDto } from '../usuarios/usuarios.dto';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';
import { Alumno } from '../entities/alumno.entity';
import { Docente } from '../entities/docente.entity';
import { Usuario } from '../entities/usuario.entity';
import { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import { Plantel } from '../entities/plantel.entity';
import { Grupo } from '../entities/grupo.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { BitacoraAcademica } from '../entities/bitacora-academica.entity';
import { exigirGrupoConfigurable } from '../common/contexto-academico';
import { leerArchivo } from './lectura';
import { TipoImportacion } from './importaciones.dto';
interface Preview { actor: number; expira: number; tipo: TipoImportacion; filas: Record<string, string>[]; ejecutando: boolean }
export const CABECERAS: Record<TipoImportacion, string[]> = {
  ALUMNOS: ['email', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'matricula', 'plantelId', 'curp', 'fechaNacimiento', 'telefono', 'tutorNombre', 'tutorTelefono', 'direccion'],
  DOCENTES: ['email', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'numEmpleado', 'plantelIds', 'cedulaProfesional', 'especialidad', 'telefono'],
  PERSONAL: ['email', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'roles', 'plantelIds', 'telefono'],
  INSCRIPCIONES: ['matricula', 'grupoId'],
};
@Injectable()
export class ImportacionesService {
  private readonly previews = new Map<string, Preview>();
  constructor(private readonly ds: DataSource, private readonly usuarios: UsuariosService, private readonly scope: ScopeService) {}
  private autorizar(tipo: TipoImportacion, user: JwtUser) { if (tipo === 'PERSONAL' && !user.roles.includes('SUPERADMIN')) throw new ForbiddenException('Importar personal corresponde a Superadmin'); }
  private preparar(tipo: TipoImportacion, fila: Record<string, string>) {
    const datos: Record<string, unknown> = Object.fromEntries(Object.entries(fila).filter(([, v]) => v !== ''));
    if (Object.keys(fila).some((k) => !CABECERAS[tipo].includes(k))) throw new BadRequestException('Hay columnas no admitidas; descarga la plantilla');
    if (tipo !== 'INSCRIPCIONES') datos.password = randomBytes(24).toString('base64url');
    if (tipo === 'PERSONAL') datos.roles = String(datos.roles ?? '').split(';').filter(Boolean);
    if (tipo === 'DOCENTES' || tipo === 'PERSONAL') datos.plantelIds = String(datos.plantelIds ?? '').split(';').filter(Boolean).map(Number);
    return datos;
  }
  private async validarFila(manager: EntityManager, tipo: TipoImportacion, fila: Record<string, string>, user: JwtUser, vistos: Set<string>) {
    const datos = this.preparar(tipo, fila);
    if (tipo === 'INSCRIPCIONES') {
      const grupoId = Number(datos.grupoId); const matricula = String(datos.matricula ?? '').toUpperCase();
      if (!Number.isSafeInteger(grupoId) || grupoId < 1 || !matricula || matricula.length > 20) throw new BadRequestException('Se requiere grupoId y matrícula válidos');
      const grupo = await manager.getRepository(Grupo).findOneBy({ id: grupoId });
      if (!grupo) throw new NotFoundException('Grupo inexistente');
      await this.scope.validarGestion(user, grupo.plantelId); exigirGrupoConfigurable(grupo);
      const alumno = await manager.getRepository(Alumno).findOneBy({ matricula });
      if (!alumno || alumno.estatus !== 'ACTIVO' || !alumno.usuario.activo || alumno.plantelId !== grupo.plantelId) throw new ConflictException('Alumno inexistente, inactivo o fuera del plantel');
      const clave = `INS:${alumno.id}:${grupo.cicloId}`;
      if (vistos.has(clave)) throw new ConflictException('Inscripción duplicada en el archivo para el mismo ciclo'); vistos.add(clave);
      if (await manager.getRepository(Inscripcion).findOne({ where: { alumnoId: alumno.id, estatus: 'ACTIVA', grupo: { cicloId: grupo.cicloId } } })) throw new ConflictException('Ya existe inscripción activa para ese ciclo');
      return { clase: 'INSCRIPCION', tipo, grupo, alumno } as const;
    }
    const instancia = tipo === 'ALUMNOS' ? plainToInstance(CrearAlumnoDto, datos) : tipo === 'DOCENTES' ? plainToInstance(CrearDocenteDto, datos) : plainToInstance(CrearUsuarioDto, datos);
    const errores = await validate(instancia, { whitelist: true, forbidNonWhitelisted: true });
    if (errores.length) throw new BadRequestException(`Campos inválidos: ${errores.map((e) => e.property).join(', ')}`);
    const ids = tipo === 'ALUMNOS' ? [(instancia as CrearAlumnoDto).plantelId] : (instancia as CrearDocenteDto | CrearUsuarioDto).plantelIds ?? [];
    if (!ids.length) throw new BadRequestException('Selecciona al menos un plantel');
    for (const id of ids) { await this.scope.validarGestion(user, id); if (!await manager.getRepository(Plantel).findOneBy({ id, activo: true })) throw new ConflictException('Plantel inactivo o inexistente'); }
    if (tipo === 'PERSONAL' && (instancia as CrearUsuarioDto).roles.some((r) => !['ADMINISTRATIVO', 'FINANZAS'].includes(r))) throw new BadRequestException('La importación de personal admite Administrativo y Finanzas');
    const email = instancia.email.toLowerCase();
    if (vistos.has(`EMAIL:${email}`) || await manager.getRepository(Usuario).findOne({ where: { email }, withDeleted: true })) throw new ConflictException('Correo ya registrado o duplicado en el archivo'); vistos.add(`EMAIL:${email}`);
    if (tipo === 'ALUMNOS' || tipo === 'DOCENTES') {
      const identificador = tipo === 'ALUMNOS' ? (instancia as CrearAlumnoDto).matricula : (instancia as CrearDocenteDto).numEmpleado;
      const clave = `${tipo}:${identificador.toUpperCase()}`;
      const existe = tipo === 'ALUMNOS' ? await manager.getRepository(Alumno).findOne({ where: { matricula: identificador }, withDeleted: true }) : await manager.getRepository(Docente).findOne({ where: { numEmpleado: identificador }, withDeleted: true });
      if (vistos.has(clave) || existe) throw new ConflictException('Identificador ya registrado o duplicado en el archivo'); vistos.add(clave);
    }
    return { clase: 'CUENTA', tipo, instancia, ids } as const;
  }
  async preview(tipo: TipoImportacion, buffer: Buffer, nombre: string, user: JwtUser) {
    this.autorizar(tipo, user);
    for (const [id, p] of this.previews) if (p.expira < Date.now()) this.previews.delete(id);
    if (this.previews.size >= 100 || [...this.previews.values()].filter((p) => p.actor === user.sub).length >= 5) throw new BadRequestException('Confirma tus previsualizaciones pendientes o espera su expiración de 15 minutos');
    const filas = await leerArchivo(buffer, nombre); const errores: { fila: number; mensaje: string }[] = []; const vistos = new Set<string>();
    await this.ds.transaction(async (manager) => { for (let i = 0; i < filas.length; i++) {
      try { await this.validarFila(manager, tipo, filas[i], user, vistos); }
      catch (e) { errores.push({ fila: i + 2, mensaje: e instanceof BadRequestException || e instanceof ConflictException || e instanceof ForbiddenException || e instanceof NotFoundException ? e.message : 'No fue posible validar la fila' }); }
    } });
    const previewId = errores.length ? null : randomUUID();
    if (previewId) this.previews.set(previewId, { actor: user.sub, expira: Date.now() + 15 * 60000, tipo, filas, ejecutando: false });
    return { previewId, registros: filas.length, errores, identificadores: filas.map((f, i) => ({ fila: i + 2, identificador: f.matricula ?? f.numEmpleado ?? f.email })), regla: 'Confirmación atómica. Cuentas nuevas se activan estableciendo contraseña mediante recuperación por correo; no se entregan contraseñas en la importación.' };
  }
  async confirmar(previewId: string, confirmado: boolean, user: JwtUser) {
    const p = this.previews.get(previewId);
    if (!confirmado) throw new BadRequestException('Confirma explícitamente la previsualización');
    if (!p || p.expira < Date.now() || p.actor !== user.sub) throw new NotFoundException('Previsualización expirada o no disponible para tu sesión');
    if (p.ejecutando) throw new ConflictException('La importación ya se está procesando');
    this.autorizar(p.tipo, user); p.ejecutando = true;
    try {
      const resultado = await this.ds.transaction('SERIALIZABLE', async (manager) => {
        const vistos = new Set<string>(); let insertados = 0;
        for (const fila of p.filas) {
          const validada = await this.validarFila(manager, p.tipo, fila, user, vistos);
          let entidadId: number; let plantelId: number;
          if (validada.clase === 'INSCRIPCION') {
            const repo = manager.getRepository(Inscripcion); const previa = await repo.findOneBy({ alumnoId: validada.alumno.id, grupoId: validada.grupo.id });
            if (previa) { await repo.update(previa.id, { estatus: 'ACTIVA' }); entidadId = previa.id; }
            else entidadId = (await repo.save(repo.create({ alumnoId: validada.alumno.id, grupoId: validada.grupo.id, estatus: 'ACTIVA' }))).id;
            plantelId = validada.grupo.plantelId;
          } else {
            const d = validada.instancia;
            const usuario = await this.usuarios.crear({ email: d.email, password: d.password, nombre: d.nombre, apellidoPaterno: d.apellidoPaterno, apellidoMaterno: d.apellidoMaterno, telefono: d.telefono, roles: p.tipo === 'ALUMNOS' ? ['ALUMNO'] : p.tipo === 'DOCENTES' ? ['MAESTRO'] : (d as CrearUsuarioDto).roles }, manager);
            plantelId = validada.ids[0]; entidadId = usuario.id;
            if (p.tipo === 'ALUMNOS') {
              const a = d as CrearAlumnoDto; const repo = manager.getRepository(Alumno);
              entidadId = (await repo.save(repo.create({ usuarioId: usuario.id, plantelId: a.plantelId, matricula: a.matricula, curp: a.curp ?? null, fechaNacimiento: a.fechaNacimiento ?? null, tutorNombre: a.tutorNombre ?? null, tutorTelefono: a.tutorTelefono ?? null, direccion: a.direccion ?? null }))).id;
            } else {
              if (p.tipo === 'DOCENTES') { const d = validada.instancia as CrearDocenteDto; const repo = manager.getRepository(Docente); entidadId = (await repo.save(repo.create({ usuarioId: usuario.id, numEmpleado: d.numEmpleado, cedulaProfesional: d.cedulaProfesional ?? null, especialidad: d.especialidad ?? null }))).id; }
              for (const id of validada.ids) await manager.getRepository(UsuarioPlantel).insert({ usuarioId: usuario.id, plantelId: id, activo: true });
            }
          }
          await manager.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId, accion: `IMPORTAR_${p.tipo}`, entidadId, detalle: 'Alta desde archivo validado y confirmado; sin datos personales en bitácora', fecha: new Date() }); insertados++;
        }
        return { insertados, activacion: p.tipo === 'INSCRIPCIONES' ? null : 'Establecer contraseña mediante recuperación por correo o reinicio temporal autorizado en la cuenta.' };
      });
      this.previews.delete(previewId); return resultado;
    } catch (e) { p.ejecutando = false; if (e instanceof BadRequestException || e instanceof ForbiddenException || e instanceof ConflictException || e instanceof NotFoundException) throw e; throw new ConflictException('La importación no se aplicó; revisa duplicados o cambios concurrentes y genera otra previsualización'); }
  }
}
