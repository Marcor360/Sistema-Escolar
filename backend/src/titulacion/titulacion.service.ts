import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtUser } from '../common/current-user.decorator';
import { Alumno } from '../entities/alumno.entity';
import { CarreraPlan } from '../entities/carrera-plan.entity';
import { EgresoAlumno } from '../entities/egreso-alumno.entity';
import { TitulacionExpediente } from '../entities/titulacion-expediente.entity';
import { ScopeService } from '../planteles/scope.service';
import { PaginacionDto } from '../common/paginacion.dto';
import { CrearExpedienteTitulacionDto } from './titulacion.dto';

@Injectable()
export class TitulacionService {
  constructor(
    @InjectRepository(TitulacionExpediente) private readonly expedientes: Repository<TitulacionExpediente>,
    @InjectRepository(EgresoAlumno) private readonly egresos: Repository<EgresoAlumno>,
    @InjectRepository(CarreraPlan) private readonly carreras: Repository<CarreraPlan>,
    @InjectRepository(Alumno) private readonly alumnos: Repository<Alumno>,
    private readonly scope: ScopeService,
  ) {}

  private exigirDirector(actor: JwtUser): void {
    if (actor.portal === 'MOVIL' || !actor.roles.includes('DIRECTOR')) {
      throw new ForbiddenException('La titulación institucional requiere el rol DIRECTOR desde web');
    }
  }

  async crearBorrador(dto: CrearExpedienteTitulacionDto, actor: JwtUser) {
    this.exigirDirector(actor);
    const egreso = await this.egresos.findOne({ where: { id: dto.egresoId } });
    if (!egreso) throw new NotFoundException('Egreso institucional no encontrado');
    const alumno = await this.alumnos.findOne({ where: { id: egreso.alumnoId } });
    if (!alumno || alumno.estatus !== 'EGRESADO') {
      throw new ConflictException('El alumno aún no tiene un egreso elegible');
    }
    await this.scope.validarGestion(actor, alumno.plantelId);
    const carrera = await this.carreras.findOne({ where: { id: dto.carreraPlanId, activo: true } });
    if (!carrera || carrera.plantelId !== alumno.plantelId) {
      throw new ConflictException('El programa académico no pertenece al plantel del egresado');
    }
    const existente = await this.expedientes.findOne({
      where: { egresoId: egreso.id, carreraPlanId: carrera.id },
    });
    if (existente) throw new ConflictException('Ya existe un expediente para este egreso y programa');
    const expediente = this.expedientes.create({
      egresoId: egreso.id,
      carreraPlanId: carrera.id,
      creadoPorId: actor.sub,
      estado: 'BORRADOR',
      modalidadRvoe: 'SIN_DETERMINAR',
    });
    const creado = await this.expedientes.save(expediente);
    return { id: creado.id, egresoId: creado.egresoId, carreraPlanId: creado.carreraPlanId,
      estado: creado.estado, modalidadRvoe: creado.modalidadRvoe };
  }

  async listar(query: PaginacionDto, actor: JwtUser) {
    this.exigirDirector(actor);
    const permitidos = await this.scope.plantelesDe(actor);
    if (!permitidos?.length) throw new ForbiddenException('Asigna un plantel autorizado al director');
    const pagina = query.pagina ?? 1;
    const porPagina = Math.min(query.porPagina ?? 10, 50);
    const qb = this.expedientes.createQueryBuilder('exp')
      .innerJoin('exp.egreso', 'eg')
      .innerJoin('eg.alumno', 'al')
      .andWhere('al.plantelId IN (:...permitidos)', { permitidos });
    const [filas, total] = await qb.orderBy('exp.id', 'DESC')
      .skip((pagina - 1) * porPagina).take(porPagina).getManyAndCount();
    return {
      datos: filas.map((exp) => ({
        id: exp.id, egresoId: exp.egresoId, carreraPlanId: exp.carreraPlanId,
        estado: exp.estado, modalidadRvoe: exp.modalidadRvoe,
      })), total, pagina, porPagina,
    };
  }
}
