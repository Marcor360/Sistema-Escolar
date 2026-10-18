import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BitacoraAcademica, Materia, MateriaContexto, PeriodoAcademico } from '../entities';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';
import { PaginacionDto } from '../common/paginacion.dto';
@Injectable()
export class MateriaContextosService {
  constructor(private readonly ds: DataSource, private readonly scope: ScopeService) {}
  async listar(materiaId: number, query: PaginacionDto, user: JwtUser) {
    if (!await this.ds.getRepository(Materia).findOneBy({ id: materiaId })) throw new NotFoundException('Materia no encontrada');
    const ids = await this.scope.resolverFiltro(user);
    const qb = this.ds.getRepository(MateriaContexto).createQueryBuilder('v')
      .innerJoinAndSelect('v.periodoAcademico', 'p').innerJoinAndSelect('p.carrera', 'c')
      .innerJoinAndSelect('c.nivel', 'n').innerJoinAndSelect('p.plantel', 'pl').innerJoinAndSelect('p.ciclo', 'ci')
      .where('v.materia_id = :materiaId AND v.activo = :activo', { materiaId, activo: true });
    if (ids !== null) qb.andWhere('p.plantel_id IN (:...ids)', { ids });
    const [datos, total] = await qb.orderBy('v.id', 'ASC').skip((query.pagina - 1) * query.porPagina).take(query.porPagina).getManyAndCount();
    return { datos, total, pagina: query.pagina, porPagina: query.porPagina };
  }
  async vincular(materiaId: number, periodoAcademicoId: number, user: JwtUser) {
    return this.ds.transaction('READ COMMITTED', async m => {
      const materia = await m.getRepository(Materia).findOne({ where: { id: materiaId }, lock: { mode: 'pessimistic_write' } });
      if (!materia) throw new NotFoundException('Materia no encontrada');
      if (!materia.activo) throw new ConflictException('La materia no está activa');
      const periodo = await m.getRepository(PeriodoAcademico).findOne({ where: { id: periodoAcademicoId }, relations: { carrera: { nivel: true }, plantel: true }, lock: { mode: 'pessimistic_write' } });
      if (!periodo) throw new NotFoundException('Periodo no encontrado');
      await this.scope.validarGestion(user, periodo.plantelId);
      if (!periodo.activo || !periodo.carrera.activo || !periodo.carrera.nivel.activo || !periodo.plantel.activo) throw new ConflictException('El contexto académico debe estar activo');
      const repo = m.getRepository(MateriaContexto), previo = await repo.findOneBy({ materiaId, periodoAcademicoId });
      if (previo?.activo) throw new ConflictException('La materia ya está vinculada a este periodo');
      const resultado = previo ? { ...previo, activo: true } : await repo.save({ materiaId, periodoAcademicoId, activo: true });
      if (previo) await repo.update(previo.id, { activo: true });
      await m.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId: periodo.plantelId, accion: 'MATERIA_CONTEXTO_VINCULADO', entidadId: resultado.id, detalle: `materia=${materiaId}; periodo=${periodoAcademicoId}`, fecha: new Date() });
      return resultado;
    });
  }
  async retirar(materiaId: number, id: number, user: JwtUser) {
    return this.ds.transaction(async m => {
      const repo = m.getRepository(MateriaContexto);
      const vinculo = await repo.findOne({ where: { id, materiaId }, relations: { periodoAcademico: true }, lock: { mode: 'pessimistic_write' } });
      if (!vinculo) throw new NotFoundException('Vínculo no encontrado');
      await this.scope.validarGestion(user, vinculo.periodoAcademico.plantelId);
      await repo.update(id, { activo: false });
      if (vinculo.activo) await m.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId: vinculo.periodoAcademico.plantelId, accion: 'MATERIA_CONTEXTO_RETIRADO', entidadId: id, detalle: `materia=${materiaId}; periodo=${vinculo.periodoAcademicoId}`, fecha: new Date() });
      return { ok: true };
    });
  }
}
