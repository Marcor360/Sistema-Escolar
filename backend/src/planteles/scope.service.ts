import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JwtUser } from '../common/current-user.decorator';
import { UsuarioPlantel } from '../entities/usuario-plantel.entity';

@Injectable()
export class ScopeService {
  constructor(
    @InjectRepository(UsuarioPlantel)
    private readonly usuarioPlanteles: Repository<UsuarioPlantel>,
  ) {}

  async plantelesDe(user: JwtUser): Promise<number[] | null> {
    if (user.roles.includes('SUPERADMIN')) return null;
    const asignaciones = await this.usuarioPlanteles.find({
      where: { usuarioId: user.sub, activo: true },
    });
    return asignaciones.map((a) => a.plantelId);
  }

  async resolverFiltro(user: JwtUser, plantelId?: number): Promise<number[] | null> {
    const permitidos = await this.plantelesDe(user);
    if (permitidos === null) return plantelId ? [plantelId] : null;
    if (plantelId !== undefined) {
      if (!permitidos.includes(plantelId)) {
        throw new ForbiddenException('El plantel solicitado está fuera de tu alcance');
      }
      return [plantelId];
    }
    if (permitidos.length === 0) throw new ForbiddenException('No tienes planteles asignados');
    return permitidos;
  }

  async validarGestion(user: JwtUser, plantelId: number | null | undefined) {
    if (!plantelId) throw new ForbiddenException('El plantel es obligatorio');
    return this.resolverFiltro(user, plantelId);
  }

  condicion(ids: number[] | null) {
    return ids === null ? undefined : In(ids);
  }
}
