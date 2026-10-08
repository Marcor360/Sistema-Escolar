import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, In, LessThan } from 'typeorm';
import { randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CrearAlumnoDto } from '../alumnos/alumnos.dto';
import { CrearDocenteDto } from '../docentes/docentes.dto';
import { CrearUsuarioDto } from '../usuarios/usuarios.dto';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';
import { Alumno, Docente, Usuario, UsuarioPlantel, Plantel, Grupo, CicloEscolar, Inscripcion, BitacoraAcademica, Rol, ImportacionPreview, ImportacionFila } from '../entities';
import { exigirGrupoConfigurable } from '../common/contexto-academico';
import { leerArchivo } from './lectura';
import { TipoImportacion } from './importaciones.dto';
import { PreviewCifrado } from './preview-cifrado';
type Fila = Record<string,string>;
interface Catalogos {
  permitidos: Set<number> | null; planteles: Map<number,Plantel>; grupos: Map<number,Grupo>; alumnos: Map<string,Alumno>;
  emails: Set<string>; identificadores: Set<string>; inscripciones: Set<string>; previas: Map<string,Inscripcion>; roles: Map<string,Rol>;
}
const trozos = <T>(filas: T[]) => Array.from({ length: Math.ceil(filas.length / 100) }, (_, i) => filas.slice(i*100,(i+1)*100));
export const CABECERAS: Record<TipoImportacion, string[]> = {
  ALUMNOS: ['email', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'matricula', 'plantelId', 'curp', 'fechaNacimiento', 'telefono', 'tutorNombre', 'tutorTelefono', 'direccion'],
  DOCENTES: ['email', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'numEmpleado', 'plantelIds', 'cedulaProfesional', 'especialidad', 'telefono'],
  PERSONAL: ['email', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'roles', 'plantelIds', 'telefono'],
  INSCRIPCIONES: ['matricula', 'grupoId'],
};
@Injectable()
export class ImportacionesService {
  private readonly cifrado: PreviewCifrado;
  constructor(private readonly ds: DataSource, private readonly scope: ScopeService, config: ConfigService) { this.cifrado = new PreviewCifrado(config.getOrThrow<string>('JWT_SECRET')); }
  private autorizar(tipo: TipoImportacion, user: JwtUser) { if (tipo === 'PERSONAL' && !user.roles.includes('SUPERADMIN')) throw new ForbiddenException('Importar personal corresponde a Superadmin'); }
  private preparar(tipo: TipoImportacion, fila: Fila) {
    const datos: Record<string, unknown> = Object.fromEntries(Object.entries(fila).filter(([, v]) => v !== ''));
    if (Object.keys(fila).some((k) => !CABECERAS[tipo].includes(k))) throw new BadRequestException('Hay columnas no admitidas; descarga la plantilla');
    if (tipo !== 'INSCRIPCIONES') datos.password = randomBytes(24).toString('base64url');
    if (tipo === 'PERSONAL') datos.roles = String(datos.roles ?? '').split(';').filter(Boolean);
    if (tipo === 'DOCENTES' || tipo === 'PERSONAL') datos.plantelIds = String(datos.plantelIds ?? '').split(';').filter(Boolean).map(Number);
    return datos;
  }
  private async catalogos(manager: EntityManager, tipo: TipoImportacion, filas: Fila[], user: JwtUser, bloquear: boolean): Promise<Catalogos> {
    const scope = await this.scope.resolverFiltro(user);
    const c: Catalogos = { permitidos: scope === null ? null : new Set(scope), planteles: new Map(), grupos: new Map(), alumnos: new Map(), emails: new Set(), identificadores: new Set(), inscripciones: new Set(), previas: new Map(), roles: new Map() };
    const numericos = (valores: string[]) => [...new Set(valores.map(Number).filter((n) => Number.isSafeInteger(n) && n > 0))];
    const lock = bloquear ? { lock: { mode: 'pessimistic_write' as const } } : {};
    if (tipo === 'INSCRIPCIONES') {
      const ids = numericos(filas.map((f) => f.grupoId));
      let grupos = ids.length ? await manager.getRepository(Grupo).find({ where: { id: In(ids) }, order: { id: 'ASC' } }) : [];
      if (bloquear && grupos.length) {
        const ciclos = await manager.getRepository(CicloEscolar).find({ where: { id: In([...new Set(grupos.map((g) => g.cicloId))]) }, order: { id: 'ASC' }, ...lock });
        const planteles = await manager.getRepository(Plantel).find({ where: { id: In([...new Set(grupos.map((g) => g.plantelId))]) }, order: { id: 'ASC' }, ...lock });
        grupos = await manager.getRepository(Grupo).find({ where: { id: In(ids) }, order: { id: 'ASC' }, ...lock });
        for (const g of grupos) { const ciclo = ciclos.find((x) => x.id === g.cicloId), plantel = planteles.find((x) => x.id === g.plantelId); if (!ciclo || !plantel) throw new ConflictException('El contexto académico cambió'); g.ciclo = ciclo; g.plantel = plantel; }
      }
      c.grupos = new Map(grupos.map((g) => [g.id,g]));
      const matriculas = [...new Set(filas.map((f) => (f.matricula ?? '').toUpperCase()))];
      const alumnos = matriculas.length ? await manager.getRepository(Alumno).find({ where: { matricula: In(matriculas) }, order: { id: 'ASC' }, ...lock }) : [];
      c.alumnos = new Map(alumnos.map((a) => [a.matricula.toUpperCase(),a]));
      const alumnoIds = alumnos.map((a) => a.id);
      if (alumnoIds.length) {
        const activas = await manager.getRepository(Inscripcion).createQueryBuilder('i').innerJoin('i.grupo','g').select('i.alumno_id','alumno').addSelect('g.ciclo_id','ciclo').where('i.alumno_id IN (:...ids) AND i.estatus = :estado',{ ids: alumnoIds, estado: 'ACTIVA' }).getRawMany<{ alumno: number; ciclo: number }>();
        c.inscripciones = new Set(activas.map((i) => `${i.alumno}:${i.ciclo}`));
        if (ids.length) { const previas = await manager.getRepository(Inscripcion).find({ where: { alumnoId: In(alumnoIds), grupoId: In(ids) }, select: { id: true, alumnoId: true, grupoId: true, estatus: true }, loadEagerRelations: false }); c.previas = new Map(previas.map((i) => [`${i.alumnoId}:${i.grupoId}`,i])); }
      }
    } else {
      const ids = numericos(filas.flatMap((f) => tipo === 'ALUMNOS' ? [f.plantelId] : (f.plantelIds ?? '').split(';')));
      if (ids.length) c.planteles = new Map((await manager.getRepository(Plantel).find({ where: { id: In(ids) }, order: { id: 'ASC' }, ...lock })).map((p) => [p.id,p]));
      const emails = [...new Set(filas.map((f) => (f.email ?? '').toLowerCase()))];
      if (emails.length) c.emails = new Set((await manager.getRepository(Usuario).find({ where: { email: In(emails) }, select: { email: true }, loadEagerRelations: false, withDeleted: true })).map((u) => u.email.toLowerCase()));
      const identificadores = [...new Set(filas.map((f) => (tipo === 'ALUMNOS' ? f.matricula : f.numEmpleado) ?? '').map((s) => s.toUpperCase()))];
      if (tipo === 'ALUMNOS' && identificadores.length) c.identificadores = new Set((await manager.getRepository(Alumno).find({ where: { matricula: In(identificadores) }, select: { matricula: true }, loadEagerRelations: false, withDeleted: true })).map((a) => a.matricula.toUpperCase()));
      if (tipo === 'DOCENTES' && identificadores.length) c.identificadores = new Set((await manager.getRepository(Docente).find({ where: { numEmpleado: In(identificadores) }, select: { numEmpleado: true }, loadEagerRelations: false, withDeleted: true })).map((a) => a.numEmpleado.toUpperCase()));
      c.roles = new Map((await manager.getRepository(Rol).find()).map((r) => [r.clave,r]));
    }
    return c;
  }
  private async validarFila(tipo: TipoImportacion, fila: Fila, c: Catalogos, vistos: Set<string>) {
    const datos = this.preparar(tipo, fila);
    if (tipo === 'INSCRIPCIONES') {
      const grupoId = Number(datos.grupoId), matricula = String(datos.matricula ?? '').toUpperCase();
      if (!Number.isSafeInteger(grupoId) || grupoId < 1 || !matricula || matricula.length > 20) throw new BadRequestException('Se requiere grupoId y matrícula válidos');
      const grupo = c.grupos.get(grupoId); if (!grupo) throw new NotFoundException('Grupo inexistente');
      if (c.permitidos !== null && !c.permitidos.has(grupo.plantelId)) throw new ForbiddenException('El plantel solicitado está fuera de tu alcance');
      exigirGrupoConfigurable(grupo);
      const alumno = c.alumnos.get(matricula);
      if (!alumno || alumno.estatus !== 'ACTIVO' || !alumno.usuario.activo || alumno.plantelId !== grupo.plantelId) throw new ConflictException('Alumno inexistente, inactivo o fuera del plantel');
      const clave = `${alumno.id}:${grupo.cicloId}`; if (vistos.has(clave)) throw new ConflictException('Inscripción duplicada en el archivo para el mismo ciclo'); vistos.add(clave);
      if (c.inscripciones.has(clave)) throw new ConflictException('Ya existe inscripción activa para ese ciclo');
      return { clase: 'INSCRIPCION', tipo, grupo, alumno } as const;
    }
    const instancia = tipo === 'ALUMNOS' ? plainToInstance(CrearAlumnoDto, datos) : tipo === 'DOCENTES' ? plainToInstance(CrearDocenteDto, datos) : plainToInstance(CrearUsuarioDto, datos);
    const errores = await validate(instancia, { whitelist: true, forbidNonWhitelisted: true });
    if (errores.length) throw new BadRequestException(`Campos inválidos: ${errores.map((e) => e.property).join(', ')}`);
    const ids = tipo === 'ALUMNOS' ? [(instancia as CrearAlumnoDto).plantelId] : (instancia as CrearDocenteDto | CrearUsuarioDto).plantelIds ?? [];
    if (!ids.length) throw new BadRequestException('Selecciona al menos un plantel');
    for (const id of ids) { if (c.permitidos !== null && !c.permitidos.has(id)) throw new ForbiddenException('El plantel solicitado está fuera de tu alcance'); if (!c.planteles.get(id)?.activo) throw new ConflictException('Plantel inactivo o inexistente'); }
    if (tipo === 'PERSONAL' && (instancia as CrearUsuarioDto).roles.some((r) => !['ADMINISTRATIVO', 'FINANZAS'].includes(r))) throw new BadRequestException('La importación de personal admite Administrativo y Finanzas');
    const email = instancia.email.toLowerCase(); if (vistos.has(`EMAIL:${email}`) || c.emails.has(email)) throw new ConflictException('Correo ya registrado o duplicado en el archivo'); vistos.add(`EMAIL:${email}`);
    if (tipo === 'ALUMNOS' || tipo === 'DOCENTES') {
      const id = (tipo === 'ALUMNOS' ? (instancia as CrearAlumnoDto).matricula : (instancia as CrearDocenteDto).numEmpleado).toUpperCase();
      if (vistos.has(`${tipo}:${id}`) || c.identificadores.has(id)) throw new ConflictException('Identificador ya registrado o duplicado en el archivo'); vistos.add(`${tipo}:${id}`);
    }
    return { clase: 'CUENTA', tipo, instancia, ids } as const;
  }
  private aad(p: ImportacionPreview, posicion: number) { return `${p.id}:${p.actorId}:${p.tipo}:${posicion}`; }
  async preview(tipo: TipoImportacion, buffer: Buffer, nombre: string, user: JwtUser) {
    this.autorizar(tipo,user); const filas = await leerArchivo(buffer,nombre), errores: { fila: number; mensaje: string }[] = [];
    await this.ds.transaction(async (manager) => { const c = await this.catalogos(manager,tipo,filas,user,false), vistos = new Set<string>();
      for (let i=0;i<filas.length;i++) { try { await this.validarFila(tipo,filas[i],c,vistos); } catch (e) { errores.push({ fila: i+2, mensaje: e instanceof BadRequestException || e instanceof ConflictException || e instanceof ForbiddenException || e instanceof NotFoundException ? e.message : 'No fue posible validar la fila' }); } }
    });
    let previewId: string | null = null;
    if (!errores.length) {
      const p = this.ds.getRepository(ImportacionPreview).create({ id: randomUUID(), actorId: user.sub, tipo, expira: new Date(Date.now()+15*60000) });
      const cifradas = filas.map((fila,posicion) => ({ previewId: p.id, posicion, contenido: this.cifrado.cifrar(fila,this.aad(p,posicion)) }));
      if (cifradas.some((f) => f.contenido.length > 8000)) throw new BadRequestException('Una fila excede el límite de previsualización');
      await this.ds.transaction(async (manager) => {
        await manager.getRepository(Usuario).findOne({ where: { id: user.sub }, lock: { mode: 'pessimistic_write' }, loadEagerRelations: false });
        const repo = manager.getRepository(ImportacionPreview); await repo.delete({ expira: LessThan(new Date()) });
        if (await repo.count() >= 100 || await repo.countBy({ actorId: user.sub }) >= 5) throw new BadRequestException('Confirma tus previsualizaciones pendientes o espera su expiración de 15 minutos');
        await repo.insert(p); for (const lote of trozos(cifradas)) await manager.getRepository(ImportacionFila).insert(lote);
      }); previewId = p.id;
    }
    return { previewId, registros: filas.length, errores, identificadores: filas.map((f,i) => ({ fila: i+2, identificador: f.matricula ?? f.numEmpleado ?? f.email })), regla: 'Confirmación atómica. Cuentas nuevas se activan estableciendo contraseña mediante recuperación por correo; no se entregan contraseñas en la importación.' };
  }
  private comprobar(p: ImportacionPreview | null, user: JwtUser): asserts p is ImportacionPreview { if (!p || p.expira < new Date() || p.actorId !== user.sub) throw new NotFoundException('Previsualización expirada, consumida o no disponible para tu sesión'); this.autorizar(p.tipo,user); }
  async confirmar(previewId: string, confirmado: boolean, user: JwtUser) {
    if (!confirmado) throw new BadRequestException('Confirma explícitamente la previsualización');
    const previa = await this.ds.getRepository(ImportacionPreview).findOneBy({ id: previewId }); this.comprobar(previa,user);
    const cifradas = await this.ds.getRepository(ImportacionFila).find({ where: { previewId }, order: { posicion: 'ASC' } });
    let filas: Fila[]; try { filas = cifradas.map((f) => this.cifrado.descifrar(f.contenido,this.aad(previa,f.posicion))); } catch { throw new NotFoundException('Genera otra previsualización: clave cambiada o contenido inválido'); }
    if (!filas.length || filas.length > 500) throw new ConflictException('Previsualización inválida');
    // El trabajo costoso de bcrypt sucede fuera de la transacción; claves aleatorias nunca entregadas.
    const hashes: string[] = []; if (previa.tipo !== 'INSCRIPCIONES') for (let i=0;i<filas.length;i+=4) hashes.push(...await Promise.all(filas.slice(i,i+4).map(() => bcrypt.hash(randomBytes(24).toString('base64url'),10))));
    try { return await this.ds.transaction('SERIALIZABLE', async (manager) => {
      const p = await manager.getRepository(ImportacionPreview).findOne({ where: { id: previewId }, lock: { mode: 'pessimistic_write' } }); this.comprobar(p,user);
      const c = await this.catalogos(manager,p.tipo,filas,user,true), vistos = new Set<string>();
      const validas = []; for (const fila of filas) validas.push(await this.validarFila(p.tipo,fila,c,vistos));
      const auditoria: { usuarioId: number; plantelId: number; accion: string; entidadId: number; detalle: string; fecha: Date }[] = [];
      const auditar = (entidadId: number, plantelId: number) => auditoria.push({ usuarioId: user.sub, plantelId, accion: `IMPORTAR_${p.tipo}`, entidadId, detalle: 'Alta desde archivo validado y confirmado; sin datos personales en bitácora', fecha: new Date() });
      const inscripciones = validas.filter((v) => v.clase === 'INSCRIPCION');
      if (inscripciones.length) {
        const repo = manager.getRepository(Inscripcion), reactivar: number[] = [], nuevas: { alumnoId: number; grupoId: number; estatus: 'ACTIVA' }[] = [];
        for (const v of inscripciones) { const anterior = c.previas.get(`${v.alumno.id}:${v.grupo.id}`); if (anterior) reactivar.push(anterior.id); else nuevas.push({ alumnoId: v.alumno.id, grupoId: v.grupo.id, estatus: 'ACTIVA' }); }
        for (const lote of trozos(reactivar)) await repo.update({ id: In(lote) },{ estatus: 'ACTIVA' });
        for (const lote of trozos(nuevas)) await repo.createQueryBuilder().insert().values(lote).updateEntity(false).execute();
        const finales = await repo.find({ where: { alumnoId: In(inscripciones.map((v) => v.alumno.id)), grupoId: In([...new Set(inscripciones.map((v) => v.grupo.id))]) }, select: { id: true, grupoId: true, alumnoId: true }, loadEagerRelations: false });
        const ids = new Map(finales.map((i) => [`${i.alumnoId}:${i.grupoId}`,i.id]));
        for (const v of inscripciones) { const id = ids.get(`${v.alumno.id}:${v.grupo.id}`); if (!id) throw new ConflictException('Inscripción no confirmada'); auditar(id,v.grupo.plantelId); }
      } else {
        const cuentas = validas.filter((v) => v.clase === 'CUENTA');
        const repo = manager.getRepository(Usuario);
        const nuevos = await repo.save(cuentas.map((v,i) => {
          const d = v.instancia, claves = p.tipo === 'ALUMNOS' ? ['ALUMNO'] : p.tipo === 'DOCENTES' ? ['MAESTRO'] : (d as CrearUsuarioDto).roles;
          const roles = [...new Set(claves)].map((clave) => { const rol = c.roles.get(clave); if (!rol) throw new ConflictException('Rol inexistente'); return rol; });
          return repo.create({ email: d.email, nombre: d.nombre, apellidoPaterno: d.apellidoPaterno, apellidoMaterno: d.apellidoMaterno ?? null, telefono: d.telefono ?? null, passwordHash: hashes[i], passwordChangeRequired: true, roles });
        }),{ chunk: 50 });
        const usuarios = new Map(nuevos.map((u) => [u.email,u.id]));
        if (p.tipo === 'ALUMNOS') {
          const alumnos = cuentas.map((v) => { const d = v.instancia as CrearAlumnoDto; return { usuarioId: usuarios.get(d.email)!, plantelId: d.plantelId, matricula: d.matricula, curp: d.curp ?? null, fechaNacimiento: d.fechaNacimiento ?? null, tutorNombre: d.tutorNombre ?? null, tutorTelefono: d.tutorTelefono ?? null, direccion: d.direccion ?? null }; });
          const repo = manager.getRepository(Alumno); for (const lote of trozos(alumnos)) await repo.createQueryBuilder().insert().values(lote).updateEntity(false).execute();
          const guardados = await repo.find({ where: { usuarioId: In(nuevos.map((u) => u.id)) }, select: { id: true, plantelId: true }, loadEagerRelations: false }); guardados.forEach((a) => auditar(a.id,a.plantelId));
        } else {
          if (p.tipo === 'DOCENTES') {
            const docentes = cuentas.map((v) => { const d = v.instancia as CrearDocenteDto; return { usuarioId: usuarios.get(d.email)!, numEmpleado: d.numEmpleado, cedulaProfesional: d.cedulaProfesional ?? null, especialidad: d.especialidad ?? null }; });
            const repo = manager.getRepository(Docente); for (const lote of trozos(docentes)) await repo.createQueryBuilder().insert().values(lote).updateEntity(false).execute();
            const guardados = await repo.find({ where: { usuarioId: In(nuevos.map((u) => u.id)) }, select: { id: true, usuarioId: true }, loadEagerRelations: false }); const planteles = new Map(cuentas.map((v) => [usuarios.get(v.instancia.email)!,v.ids[0]])); guardados.forEach((d) => auditar(d.id,planteles.get(d.usuarioId)!));
          } else cuentas.forEach((v) => auditar(usuarios.get(v.instancia.email)!,v.ids[0]));
          const asignaciones = cuentas.flatMap((v) => [...new Set(v.ids)].map((plantelId) => ({ usuarioId: usuarios.get(v.instancia.email)!, plantelId, activo: true })));
          for (const lote of trozos(asignaciones)) await manager.getRepository(UsuarioPlantel).insert(lote);
        }
      }
      if (auditoria.length !== filas.length) throw new ConflictException('El lote no está completo');
      for (const lote of trozos(auditoria)) await manager.getRepository(BitacoraAcademica).insert(lote);
      await manager.getRepository(ImportacionPreview).delete(p.id);
      return { insertados: filas.length, activacion: p.tipo === 'INSCRIPCIONES' ? null : 'Establecer contraseña mediante recuperación por correo o reinicio temporal autorizado en la cuenta.' };
    }); } catch (e) { if (e instanceof BadRequestException || e instanceof ForbiddenException || e instanceof ConflictException || e instanceof NotFoundException) throw e; throw new ConflictException('La importación no se aplicó; revisa duplicados o cambios concurrentes y genera otra previsualización'); }
  }
}
