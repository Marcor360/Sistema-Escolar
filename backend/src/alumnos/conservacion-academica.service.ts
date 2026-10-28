import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Alumno } from '../entities/alumno.entity';
import { EgresoAlumno } from '../entities/egreso-alumno.entity';
import { CicloEscolar } from '../entities/ciclo-escolar.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { Entrega } from '../entities/entrega.entity';
import { BitacoraAcademica } from '../entities/bitacora-academica.entity';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';
import { esConflictoUnico } from '../academico/conflictos';
import { fechaElegibleArchivo } from './egreso-alumno';
import { ConciliarEgresoDto } from './conservacion-academica.dto';

@Injectable()
export class ConservacionAcademicaService {
  constructor(
    private readonly ds: DataSource,
    private readonly scope: ScopeService,
  ) {}

  /** Inventario de referencias, sin rutas privadas y sin encolar ni borrar archivos. */
  async revisarAdjuntos(id: number, user: JwtUser) {
    const alumno = await this.ds.getRepository(Alumno).findOne({ where: { id } });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');
    await this.scope.validarGestion(user, alumno.plantelId);
    const egreso = await this.ds.getRepository(EgresoAlumno).findOne({ where: { alumnoId: id } });
    const planteles = await this.scope.plantelesDe(user);
    const consulta = this.ds
      .getRepository(Entrega)
      .createQueryBuilder('e')
      .innerJoin('e.actividad', 'a')
      .innerJoin('a.grupoMateria', 'gm')
      .innerJoin('gm.grupo', 'g')
      .innerJoin('g.ciclo', 'c')
      .select('c.id', 'cicloId')
      .addSelect('c.nombre', 'nombre')
      .addSelect('c.estado', 'estado')
      .addSelect('COUNT(e.id)', 'adjuntos')
      .where('e.alumno_id = :id AND e.archivo_ruta IS NOT NULL', { id });
    if (planteles !== null) {
      if (planteles.length) consulta.andWhere('g.plantel_id IN (:...planteles)', { planteles });
      else consulta.andWhere('1=0');
    }
    const ciclos = await consulta.groupBy('c.id')
      .addGroupBy('c.nombre')
      .addGroupBy('c.estado')
      .orderBy('c.id', 'DESC')
      .getRawMany<{ cicloId: number; nombre: string; estado: string; adjuntos: string }>();
    return {
      alumnoId: id,
      estadoAlumno: alumno.estatus,
      pausaDisponible: false,
      eliminacionHabilitada: false,
      egresoConciliado: alumno.estatus !== 'EGRESADO' || !!egreso,
      ciclos: ciclos.map((c) => ({ ...c, cicloId: Number(c.cicloId), adjuntos: Number(c.adjuntos) })),
      bloqueos: [
        'CONSERVACION_INSTITUCIONAL_PENDIENTE',
        'RECUPERACION_NO_VERIFICADA',
        ...(ciclos.some((c) => c.estado !== 'CERRADO') ? ['CICLO_SIN_CIERRE'] : []),
        ...(alumno.estatus === 'EGRESADO' && !egreso ? ['EGRESO_LEGADO_SIN_CONCILIAR'] : []),
      ],
      conservados: ['adjuntos', 'calificaciones', 'historiales', 'inscripciones', 'pagos'],
      aviso:
        'Este inventario no autoriza una eliminación. Un archivo académico comprimido no es un respaldo SQL completo.',
    };
  }

  /** Completa solo el registro de un egreso legado, nunca deduce sus datos ni altera el historial. */
  async conciliarEgreso(id: number, dto: ConciliarEgresoDto, user: JwtUser) {
    const fecha = new Date(dto.fechaEgreso + 'T12:00:00.000Z');
    const hoy = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    if (
      !dto.confirmado ||
      !Number.isFinite(fecha.getTime()) ||
      fecha.toISOString().slice(0, 10) !== dto.fechaEgreso ||
      dto.fechaEgreso > hoy
    ) {
      throw new BadRequestException('Confirma una fecha de egreso documentada, válida y no futura');
    }
    return this.ds.transaction(async (manager) => {
      const alumno = await manager
        .getRepository(Alumno)
        .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!alumno) throw new NotFoundException('Alumno no encontrado');
      await this.scope.validarGestion(user, alumno.plantelId);
      if (alumno.estatus !== 'EGRESADO')
        throw new ConflictException('La conciliación solo corresponde a egresados anteriores');
      if (!alumno.curp || alumno.curp !== dto.curp)
        throw new ConflictException(
          'La CURP documental no coincide; corrige y verifica la identidad antes de conciliar',
        );
      const repo = manager.getRepository(EgresoAlumno);
      if (await repo.existsBy([{ alumnoId: id }, { curp: dto.curp }]))
        throw new ConflictException('El alumno o la CURP ya tiene un egreso registrado');
      const ciclo = await manager
        .getRepository(CicloEscolar)
        .findOne({ where: { id: dto.cicloId }, lock: { mode: 'pessimistic_write' } });
      if (!ciclo || ciclo.estado !== 'CERRADO')
        throw new ConflictException('El ciclo documental debe existir y estar cerrado');
      if (dto.fechaEgreso.slice(0, 10) < ciclo.fechaInicio)
        throw new ConflictException('La fecha documentada es anterior al ciclo seleccionado');
      const inscrito = await manager
        .getRepository(Inscripcion)
        .existsBy({ alumnoId: id, grupo: { cicloId: dto.cicloId } });
      if (!inscrito)
        throw new ConflictException(
          'El ciclo no pertenece al historial del alumno; concilia primero los datos de origen',
        );
      const egreso = repo.create({
        alumnoId: id,
        cicloId: dto.cicloId,
        curp: dto.curp,
        fechaEgreso: fecha,
        fechaDocumental: dto.fechaEgreso,
        archivarDesde: fechaElegibleArchivo(fecha),
        estadoArchivo: 'VIGENTE',
        rutaArchivo: null,
        sha256Archivo: null,
        archivadoEn: null,
      });
      try {
        await repo.save(egreso);
      } catch (error) {
        if (esConflictoUnico((error as { driverError?: unknown }).driverError ?? error))
          throw new ConflictException('Otro registro ya concilió el alumno o su CURP');
        throw error;
      }
      await manager
        .getRepository(BitacoraAcademica)
        .insert({
          usuarioId: user.sub,
          plantelId: alumno.plantelId,
          accion: 'EGRESO_CONCILIADO',
          entidadId: id,
          detalle: `ciclo=${dto.cicloId}; referencia=${dto.referenciaDocumental}`,
          fecha: new Date(),
        });
      return {
        cicloId: egreso.cicloId,
        fechaEgreso: egreso.fechaEgreso,
        fechaDocumental: egreso.fechaDocumental,
        archivarDesde: egreso.archivarDesde,
        estadoArchivo: egreso.estadoArchivo,
      };
    });
  }
}
