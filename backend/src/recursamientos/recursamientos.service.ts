import { escalaDe, esRegimenNuevo, notaEnEscala, parcialesDe, resultadoEvaluacion } from '../common/regimen-evaluacion';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Alumno, BitacoraAcademica, CalificacionRecursamiento, CicloEscolar, CupoRecursamiento, GrupoMateria, HistorialRecursamiento, Inscripcion, ParticipacionAsignatura, PeriodoCalificacion, Plantel } from '../entities';
import { JwtUser } from '../common/current-user.decorator';
import { PaginacionDto } from '../common/paginacion.dto';
import { exigirGrupoConfigurable, exigirGrupoVigente } from '../common/contexto-academico';
import { ScopeService } from '../planteles/scope.service';
import { esConflictoTransaccional, esConflictoUnico } from '../academico/conflictos';
import { TransicionEspecialDto } from '../programas-especiales/programas.dto';
import { CupoRecursamientoDto, InscribirRecursamientoDto, NotaRecursamientoDto } from './recursamientos.dto';
@Injectable()
export class RecursamientosService {
  constructor(private readonly ds: DataSource, private readonly scope: ScopeService) {}
  private async tx<T>(fn: (m:EntityManager)=>Promise<T>) { try{return await this.ds.transaction('READ COMMITTED',fn);}catch(e){if(esConflictoUnico(e)||esConflictoTransaccional(e))throw new ConflictException('La participación cambió concurrentemente; vuelve a consultar');throw e;} }
  private auditar(m:EntityManager,u:JwtUser,plantelId:number,accion:string,id:number,detalle:string){return m.getRepository(BitacoraAcademica).insert({usuarioId:u.sub,plantelId,accion,entidadId:id,detalle,fecha:new Date()});}
  private async clase(id:number,u:JwtUser,m=this.ds.manager,gestionar=false) {
    const gm=await m.getRepository(GrupoMateria).findOneBy({id});if(!gm)throw new NotFoundException('Clase no encontrada');
    if(u.roles.includes('SUPERADMIN'))return gm;
    if(u.roles.includes('ADMINISTRATIVO')){await this.scope.validarGestion(u,gm.grupo.plantelId);return gm;}
    if(!gestionar&&u.roles.includes('MAESTRO')&&gm.docente?.usuarioId===u.sub){exigirGrupoConfigurable(gm.grupo);return gm;}
    throw new ForbiddenException('Clase ajena o gestión no autorizada');
  }
  private async bloquear(m:EntityManager,id:number,u:JwtUser,gestionar=true){
    const previa=await this.clase(id,u,m,gestionar);
    await m.getRepository(Plantel).findOne({where:{id:previa.grupo.plantelId},lock:{mode:'pessimistic_write'}});
    await m.getRepository(CicloEscolar).findOne({where:{id:previa.grupo.cicloId},lock:{mode:'pessimistic_write'}});
    const gm=await m.getRepository(GrupoMateria).findOneOrFail({where:{id},lock:{mode:'pessimistic_write'}});
    await this.clase(id,u,m,gestionar);return gm;
  }
  private proyectar(r:ParticipacionAsignatura,clase=r.grupoMateria){return {id:r.id,alumnoId:r.alumnoId,matricula:r.alumno?.matricula,nombre:r.alumno?.usuario.nombreCompleto,escalaMaxima:escalaDe(clase),regimenEvaluacion:clase?.regimenEvaluacion,grupoMateriaId:r.grupoMateriaId,grupo:r.grupoMateria?.grupo.nombre,materia:r.grupoMateria?.materia.nombre,intento:r.intento,estado:r.estado,inscripcionPrincipalId:r.inscripcionPrincipalId};}
  private async total(m:EntityManager,gm:GrupoMateria){return await m.getRepository(Inscripcion).countBy({grupoId:gm.grupoId,estatus:'ACTIVA'})+await m.getRepository(ParticipacionAsignatura).countBy({grupoMateriaId:gm.id,estado:'ACTIVA'});}
  async inscribir(d:InscribirRecursamientoDto,u:JwtUser){return this.tx(async m=>{
    const gm=await this.bloquear(m,d.grupoMateriaId,u);exigirGrupoConfigurable(gm.grupo);
    if(gm.grupo.tipo!=='REGULAR'||!gm.materia.activo||!gm.docente||gm.docente.estatus!=='ACTIVO'||!gm.docente.usuario.activo)throw new ConflictException('Selecciona clase regular activa con docente existente');
    const alumno=await m.getRepository(Alumno).findOne({where:{id:d.alumnoId},lock:{mode:'pessimistic_write'}});
    if(!alumno||alumno.plantelId!==gm.grupo.plantelId)throw new ForbiddenException('Alumno fuera del plantel');
    if(alumno.estatus!=='ACTIVO'||!alumno.usuario.activo)throw new ConflictException('Alumno inactivo');
    const repo=m.getRepository(ParticipacionAsignatura), previa=await repo.findOneBy({idempotencia:d.idempotencia});
    if(previa){if(previa.alumnoId!==d.alumnoId||previa.grupoMateriaId!==gm.id||previa.cupoTotalConfirmado!==d.cupoTotalManual)throw new ConflictException('La clave corresponde a otra inscripción');return this.proyectar(previa,gm);}
    const principal=await m.getRepository(Inscripcion).findOne({where:{alumnoId:d.alumnoId,estatus:'ACTIVA',grupo:{tipo:'REGULAR',cicloId:gm.grupo.cicloId,activo:true}}});
    if(!principal||principal.grupoId===gm.grupoId)throw new ConflictException('Requiere grupo principal vigente distinto del receptor; no se duplica la matrícula de la clase');
    if(!gm.grupo.nivelId||!gm.grupo.carreraId||!gm.grupo.periodoAcademicoId||principal.grupo.nivelId!==gm.grupo.nivelId||principal.grupo.carreraId!==gm.grupo.carreraId)throw new ConflictException('Configura nivel y carrera/plan compatibles en ambos grupos');
    if(await repo.existsBy({alumnoId:d.alumnoId,grupoMateriaId:gm.id,estado:'ACTIVA'}))throw new ConflictException('El alumno ya recursa esta clase');
    const cupos=m.getRepository(CupoRecursamiento),cupo=await cupos.findOneBy({grupoMateriaId:gm.id});
    if(cupo&&cupo.cupoTotalManual!==d.cupoTotalManual)throw new ConflictException('El cupo autorizado difiere; actualízalo explícitamente con motivo');
    if(await this.total(m,gm)>=d.cupoTotalManual)throw new ConflictException('El cupo total manual está completo; no aplica la excepción 51–54');
    if(!cupo)await cupos.save(cupos.create({grupoMateriaId:gm.id,cupoTotalManual:d.cupoTotalManual}));
    const ultimo=await repo.findOne({where:{alumnoId:d.alumnoId,grupoMateriaId:gm.id},order:{intento:'DESC'}});
    const r=await repo.save(repo.create({alumnoId:d.alumnoId,grupoMateriaId:gm.id,inscripcionPrincipalId:principal.id,cupoTotalConfirmado:d.cupoTotalManual,intento:(ultimo?.intento??0)+1,estado:'ACTIVA',activoClave:`${gm.id}:${d.alumnoId}`,idempotencia:d.idempotencia}));
    await this.auditar(m,u,gm.grupo.plantelId,'RECURSAMIENTO_ALTA',r.id,`clase=${gm.id}; principal=${principal.id}; cupoTotalManual=${d.cupoTotalManual}; intento=${r.intento}`);return this.proyectar(r,gm);
  });}
  async cupo(id:number,d:CupoRecursamientoDto,u:JwtUser){return this.tx(async m=>{const gm=await this.bloquear(m,id,u);exigirGrupoConfigurable(gm.grupo);if(gm.grupo.tipo!=='REGULAR')throw new ConflictException('Solo clases regulares');if(d.cupoTotalManual<await this.total(m,gm))throw new ConflictException('El cupo no puede ser menor a los inscritos de la clase');const repo=m.getRepository(CupoRecursamiento),actual=await repo.findOneBy({grupoMateriaId:id});await repo.save(actual?{...actual,cupoTotalManual:d.cupoTotalManual}:repo.create({grupoMateriaId:id,cupoTotalManual:d.cupoTotalManual}));await this.auditar(m,u,gm.grupo.plantelId,'RECURSAMIENTO_CUPO',id,`${actual?.cupoTotalManual??'sin cupo'} -> ${d.cupoTotalManual}; ${d.motivo}`);return {ok:true};});}
  async obtener(id:number,u:JwtUser){const r=await this.ds.getRepository(ParticipacionAsignatura).findOne({where:{id},relations:{alumno:{usuario:true},grupoMateria:true}});if(!r)throw new NotFoundException('Participación no encontrada');
    if(u.roles.includes('ALUMNO')&&!u.roles.some(x=>['SUPERADMIN','ADMINISTRATIVO','MAESTRO'].includes(x))){if(r.alumno.usuarioId!==u.sub)throw new ForbiddenException('Participación ajena');}else await this.clase(r.grupoMateriaId,u);
    const notas=await this.ds.getRepository(CalificacionRecursamiento).find({where:{participacionId:id},order:{parcial:'ASC'}});return {...this.proyectar(r),promedioOficial:resultadoEvaluacion(notas,r.grupoMateria),calificaciones:notas.map(n=>({parcial:n.parcial,calificacion:notaEnEscala(n,r.grupoMateria),calificacionOriginal:n.calificacion,escalaOriginal:n.escalaMaxima??100}))};}
  async terminar(id:number,estado:'BAJA'|'FINALIZADA',d:TransicionEspecialDto,u:JwtUser){const previa=await this.obtener(id,u);return this.tx(async m=>{const gm=await this.bloquear(m,previa.grupoMateriaId,u);const repo=m.getRepository(ParticipacionAsignatura),r=await repo.findOneOrFail({where:{id},lock:{mode:'pessimistic_write'}});if(r.estado===estado)return {ok:true};if(r.estado!=='ACTIVA')throw new ConflictException('El intento ya terminó');await repo.update(id,{estado,activoClave:null});await this.auditar(m,u,gm.grupo.plantelId,`RECURSAMIENTO_${estado}`,id,d.motivo);return {ok:true};});}
  async calificar(id:number,d:NotaRecursamientoDto,u:JwtUser){const previa=await this.obtener(id,u);return this.tx(async m=>{const gm=await this.bloquear(m,previa.grupoMateriaId,u,false);exigirGrupoVigente(gm.grupo);const escala=escalaDe(gm);if((esRegimenNuevo(gm)&&d.escalaMaxima!==10)||(d.escalaMaxima!==undefined&&d.escalaMaxima!==escala))throw new ConflictException(`Actualiza el cliente: captura en escala 0 a ${escala}`);if(d.calificacion<0||d.calificacion>escala||![0,...parcialesDe(gm)].includes(d.parcial))throw new BadRequestException('Nota o parcial fuera del régimen de la clase');const r=await m.getRepository(ParticipacionAsignatura).findOneByOrFail({id});if(r.estado!=='ACTIVA')throw new ConflictException('El intento está terminado');const periodo=await m.getRepository(PeriodoCalificacion).findOneBy({grupoMateriaId:gm.id,parcial:d.parcial});if(periodo?.estatus==='CERRADO')throw new ConflictException('El parcial de la clase está cerrado');const repo=m.getRepository(CalificacionRecursamiento),anterior=await repo.findOneBy({participacionId:id,parcial:d.parcial});if(anterior&&notaEnEscala(anterior,gm)===d.calificacion)return {sinCambios:true};const nota=await repo.save(anterior?{...anterior,calificacion:d.calificacion,escalaMaxima:escala,capturadaPorId:u.sub}:repo.create({participacionId:id,parcial:d.parcial,calificacion:d.calificacion,escalaMaxima:escala,capturadaPorId:u.sub}));await m.getRepository(HistorialRecursamiento).insert({participacionId:id,parcial:d.parcial,anterior:anterior?.calificacion??null,escalaAnterior:anterior?.escalaMaxima??100,escalaNueva:escala,nueva:d.calificacion,usuarioId:u.sub,motivo:d.motivo});return {id:nota.id,calificacion:nota.calificacion,escalaMaxima:escala};});}
  async listar(q:PaginacionDto,u:JwtUser,claseId?:number,propios=false){
    const qb=this.ds.getRepository(ParticipacionAsignatura).createQueryBuilder('r').innerJoinAndSelect('r.alumno','a').innerJoinAndSelect('a.usuario','u').innerJoinAndSelect('r.grupoMateria','gm').innerJoinAndSelect('gm.grupo','g').innerJoinAndSelect('gm.materia','ma');
    if(propios)qb.andWhere('a.usuario_id = :usuarioId',{usuarioId:u.sub});
    else if(claseId){await this.clase(claseId,u);qb.andWhere('r.grupo_materia_id = :claseId',{claseId});}
    else if(u.roles.includes('MAESTRO')&&!u.roles.some(r=>['SUPERADMIN','ADMINISTRATIVO'].includes(r))){qb.innerJoin('gm.docente','doc').andWhere('doc.usuario_id = :docenteUsuarioId AND g.activo = :grupoActivo',{docenteUsuarioId:u.sub,grupoActivo:true});}
    else {const planteles=await this.scope.resolverFiltro(u);if(planteles!==null)qb.andWhere('g.plantel_id IN (:...planteles)',{planteles});}
    const [filas,total]=await qb.orderBy('r.id','DESC').skip((q.pagina-1)*q.porPagina).take(q.porPagina).getManyAndCount();return {datos:filas.map(r=>this.proyectar(r)),total,pagina:q.pagina,porPagina:q.porPagina};
  }
}
