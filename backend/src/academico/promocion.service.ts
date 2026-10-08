import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { Plantel } from '../entities/plantel.entity';
import { Grupo } from '../entities/grupo.entity';
import { CicloEscolar } from '../entities/ciclo-escolar.entity';
import { Alumno } from '../entities/alumno.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { BitacoraAcademica } from '../entities/bitacora-academica.entity';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';
import { ConfirmarPromocionDto, PromocionDto } from './promocion.dto';
@Injectable()
export class PromocionService {
  constructor(private readonly ds: DataSource, private readonly scope: ScopeService) {}
  private async contexto(manager: EntityManager, dto: PromocionDto, user: JwtUser) {
    const repo = manager.getRepository(Grupo);
    let origen = await repo.findOneBy({ id: dto.origenGrupoId }); let destino = await repo.findOneBy({ id: dto.destinoGrupoId });
    if (!origen || !destino) throw new NotFoundException('Selecciona grupos existentes');
    await this.scope.validarGestion(user, origen.plantelId); await this.scope.validarGestion(user, destino.plantelId);
    const ciclos = await manager.getRepository(CicloEscolar).find({ where: { id: In([origen.cicloId, destino.cicloId]) }, order: { id: 'ASC' }, lock: { mode: 'pessimistic_write' } });
    // Ciclos -> plantel -> grupos -> alumnos: orden determinista, igual que cierre/captura.
    const plantel = await manager.getRepository(Plantel).findOne({ where: { id: destino.plantelId }, lock: { mode: 'pessimistic_write' } });
    const grupos = await repo.find({ where: { id: In([origen.id, destino.id]) }, order: { id: 'ASC' }, lock: { mode: 'pessimistic_write' } });
    origen = grupos.find((g) => g.id === dto.origenGrupoId) ?? null; destino = grupos.find((g) => g.id === dto.destinoGrupoId) ?? null;
    if (!origen || !destino) throw new NotFoundException('Selecciona grupos existentes');
    const cicloOrigen = ciclos.find((c) => c.id === origen!.cicloId), cicloDestino = ciclos.find((c) => c.id === destino!.cicloId);
    if (!cicloOrigen || !cicloDestino) throw new ConflictException('El contexto académico cambió; vuelve a consultar');
    origen.ciclo = cicloOrigen; destino.ciclo = cicloDestino;
    await this.scope.validarGestion(user, origen.plantelId); await this.scope.validarGestion(user, destino.plantelId);
    if (origen.cicloId === destino.cicloId || ciclos.find((c) => c.id === origen.cicloId)?.estado !== 'CERRADO' || ciclos.find((c) => c.id === destino.cicloId)?.estado !== 'PREPARACION') throw new ConflictException('La promoción requiere origen cerrado y destino en preparación');
    if (destino.ciclo.fechaInicio <= origen.ciclo.fechaFin) throw new ConflictException('El ciclo de destino debe ser posterior al de origen');
    if (origen.plantelId !== destino.plantelId || !destino.activo || !plantel?.activo) throw new ConflictException('El destino debe estar activo en el mismo plantel; usa transferencia para cambiar plantel');
    return { origen, destino };
  }
  async preview(dto: PromocionDto, user: JwtUser) {
    return this.ds.transaction(async (manager) => {
      const { origen, destino } = await this.contexto(manager, dto, user);
      const inscripciones = await manager.getRepository(Inscripcion).find({ where: { grupoId: origen.id, estatus: 'ACTIVA', alumno: { estatus: 'ACTIVO', usuario: { activo: true }, plantelId: destino.plantelId } } });
      const previas = await manager.getRepository(Inscripcion).find({ where: { grupo: { cicloId: destino.cicloId }, estatus: 'ACTIVA' } });
      const ocupados = new Set(previas.map((p) => p.alumnoId));
      const alumnos = inscripciones.map((i) => ({ id: i.alumnoId, matricula: i.alumno.matricula, nombre: i.alumno.usuario.nombreCompleto, elegible: !ocupados.has(i.alumnoId) }));
      return { origen: { id: origen.id, nombre: origen.nombre, cicloId: origen.cicloId }, destino: { id: destino.id, nombre: destino.nombre, cicloId: destino.cicloId }, plantel: destino.plantel.nombre, alumnos, regla: 'Solo alumnos seleccionados; la promoción no copia calificaciones ni equivale a aprobación automática.' };
    });
  }
  async confirmar(dto: ConfirmarPromocionDto, user: JwtUser) {
    if (!dto.confirmado) throw new BadRequestException('Revisa la previsualización y confirma');
    return this.ds.transaction(async (manager) => {
      const { origen, destino } = await this.contexto(manager, dto, user);
      const alumnos = await manager.getRepository(Alumno).find({ where: { id: In(dto.alumnoIds) }, order: { id: 'ASC' }, lock: { mode: 'pessimistic_write' } });
      if (alumnos.length !== dto.alumnoIds.length || alumnos.some((a) => a.estatus !== 'ACTIVO' || !a.usuario.activo || a.plantelId !== destino.plantelId)) throw new ConflictException('La selección contiene alumnos no elegibles');
      const repo = manager.getRepository(Inscripcion);
      for (const alumno of alumnos) {
        if (!await repo.findOneBy({ grupoId: origen.id, alumnoId: alumno.id, estatus: 'ACTIVA' })) throw new ConflictException('El alumno no tiene inscripción en el origen');
        if (await repo.findOne({ where: { alumnoId: alumno.id, estatus: 'ACTIVA', grupo: { cicloId: destino.cicloId } } })) throw new ConflictException('Ya existe una inscripción activa en el destino; la operación no se aplica parcialmente');
        const anterior = await repo.findOneBy({ grupoId: destino.id, alumnoId: alumno.id });
        if (anterior) await repo.update(anterior.id, { estatus: 'ACTIVA' });
        else await repo.insert({ grupoId: destino.id, alumnoId: alumno.id, estatus: 'ACTIVA' });
        await manager.getRepository(BitacoraAcademica).insert({ usuarioId: user.sub, plantelId: destino.plantelId, accion: 'PROMOCION_ALUMNO', entidadId: alumno.id, detalle: `origenGrupoId=${origen.id}; destinoGrupoId=${destino.id}`, fecha: new Date() });
      }
      return { inscritos: alumnos.length, destinoGrupoId: destino.id };
    });
  }
}
