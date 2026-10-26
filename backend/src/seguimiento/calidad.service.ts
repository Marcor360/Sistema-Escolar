import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, EntityManager, Not } from 'typeorm';
import { Alumno, Usuario } from '../entities';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';
import { CorreccionCalidadDto } from './seguimiento.dto';
const revision = (a: Alumno, u: Usuario) =>
  createHash('sha256')
    .update(JSON.stringify([a.id, a.plantelId, a.curp, u.telefono, a.updatedAt, u.updatedAt]))
    .digest('hex');
@Injectable()
export class CalidadService {
  constructor(
    private readonly ds: DataSource,
    private readonly scope: ScopeService,
  ) {}
  private async preparar(d: CorreccionCalidadDto, u: JwtUser, m: EntityManager, bloquear = false) {
    const alumno = await m
      .getRepository(Alumno)
      .findOne({ where: { id: d.alumnoId }, ...(bloquear ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
    if (!alumno) throw new NotFoundException();
    await this.scope.validarGestion(u, alumno.plantelId);
    const usuario = await m
      .getRepository(Usuario)
      .findOne({
        where: { id: alumno.usuarioId },
        ...(bloquear ? { lock: { mode: 'pessimistic_write' as const } } : {}),
      });
    if (!usuario) throw new NotFoundException();
    if (d.telefono === undefined && d.curp === undefined) throw new BadRequestException('Indica la corrección');
    const telefono = d.telefono?.trim();
    if (d.telefono !== undefined && !telefono) throw new BadRequestException('El teléfono no puede quedar vacío');
    if (d.curp && (await m.getRepository(Alumno).existsBy({ curp: d.curp, id: Not(alumno.id) })))
      throw new ConflictException('La CURP ya corresponde a otro expediente; revisa el diagnóstico de duplicados');
    return {
      alumno,
      usuario,
      actual: createHash('sha256')
        .update(revision(alumno, usuario) + JSON.stringify([telefono ?? usuario.telefono, d.curp ?? alumno.curp]))
        .digest('hex'),
      antes: { telefono: usuario.telefono, curp: alumno.curp },
      despues: { telefono: telefono ?? usuario.telefono, curp: d.curp ?? alumno.curp },
    };
  }
  async preview(d: CorreccionCalidadDto, u: JwtUser) {
    const p = await this.preparar(d, u, this.ds.manager);
    return {
      alumnoId: p.alumno.id,
      matricula: p.alumno.matricula,
      revision: p.actual,
      antes: p.antes,
      despues: p.despues,
    };
  }
  async confirmar(d: CorreccionCalidadDto, u: JwtUser) {
    return this.ds.transaction(async (m) => {
      const p = await this.preparar(d, u, m, true);
      if (d.revision !== p.actual) throw new ConflictException('El expediente cambió; vuelve a previsualizar');
      if (d.telefono !== undefined)
        await m.getRepository(Usuario).update(p.usuario.id, { telefono: p.despues.telefono });
      if (d.curp !== undefined) await m.getRepository(Alumno).update(p.alumno.id, { curp: p.despues.curp });
      return { id: p.alumno.id, ok: true };
    });
  }
}
